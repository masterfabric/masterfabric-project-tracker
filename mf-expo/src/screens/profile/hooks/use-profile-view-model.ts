import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import {
  mfGoUser,
  mfGoOrganizations,
  syncMfGoAuthToken,
} from '@/src/shared/services/mf-go-api';
import { authCredentials } from '@/src/shared/services/auth-credentials';
import { resetUserMessageSubscriptionClient } from '@/src/shared/services/user-message-subscription';
import type {
  UserProfile,
  OrganizationPayload,
  OrganizationInvitationPayload,
  OrganizationProjectPayload,
  UpsertAddressInput,
  MyAccountDeletionImpact,
} from '@/src/shared/services/mf-go-api';

/** Cross-org project visible under a member org (host `project.organizationId` ≠ listing org). GFG-180. */
export type ProfileSharedProjectEntry = {
  contextOrganizationId: string;
  contextOrganizationName: string;
  project: OrganizationProjectPayload;
  isArchived: boolean;
  /** Host org name when it is also one of the user’s organizations; otherwise null. */
  hostOrganizationName: string | null;
};
import { useAppStore } from '@/src/shared/store';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

export type UpdateProfileFields = Partial<{
  displayName: string;
  nickname: string;
  avatarURL: string;
  bio: string;
  phoneNumber: string;
  dateOfBirth: string;
  location: string;
  websiteURL: string;
  email: string;
}>;

export function useProfileViewModel() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationPayload[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitationPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateOrgSheet, setShowCreateOrgSheet] = useState(false);
  const [showSetUsernameSheet, setShowSetUsernameSheet] = useState(false);
  const [deletionImpact, setDeletionImpact] = useState<MyAccountDeletionImpact | null>(null);
  const [deletionImpactLoading, setDeletionImpactLoading] = useState(false);
  const [sharedProjects, setSharedProjects] = useState<ProfileSharedProjectEntry[]>([]);
  const [sharedProjectsLoading, setSharedProjectsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await mfGoUser.me();
      setProfile(data);
    } catch (e) {
      setError(getGraphQLErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const saveAddress = useCallback(
    async (input: UpsertAddressInput) => {
      if (!user) return t('profile.addresses.errorNotAuthenticated');
      try {
        await mfGoUser.upsertAddress(input);
        const data = await mfGoUser.me();
        setProfile(data);
        return null;
      } catch (e) {
        return getGraphQLErrorMessage(e);
      }
    },
    [user]
  );

  const deleteAddress = useCallback(
    async (addressId: string) => {
      if (!user) return t('profile.addresses.errorNotAuthenticated');
      try {
        await mfGoUser.deleteMyAddress(addressId);
        const data = await mfGoUser.me();
        setProfile(data);
        return null;
      } catch (e) {
        return getGraphQLErrorMessage(e);
      }
    },
    [user]
  );

  const fetchOrganizations = useCallback(async () => {
    if (!user) return;
    setSharedProjectsLoading(true);
    try {
      const [orgs, invs] = await Promise.all([
        mfGoOrganizations.myOrganizations(),
        mfGoOrganizations.myPendingInvitations(),
      ]);
      setOrganizations(orgs);
      setInvitations(invs);
      useAppStore.getState().setShowOrgMessagesTab(orgs.length > 0);

      const nameById = new Map(orgs.map((o) => [o.id, o.name] as const));
      const rows: ProfileSharedProjectEntry[] = [];
      if (orgs.length > 0) {
        const settled = await Promise.allSettled(
          orgs.map((org) =>
            Promise.all([
              mfGoOrganizations.organizationProjects(org.id),
              mfGoOrganizations.archivedOrganizationProjects(org.id),
            ]).then(([active, archived]) => ({ org, active, archived }))
          )
        );
        for (const s of settled) {
          if (s.status !== 'fulfilled') continue;
          const { org, active, archived } = s.value;
          for (const p of active) {
            if (p.organizationId !== org.id) {
              rows.push({
                contextOrganizationId: org.id,
                contextOrganizationName: org.name,
                project: p,
                isArchived: false,
                hostOrganizationName: nameById.get(p.organizationId) ?? null,
              });
            }
          }
          for (const p of archived) {
            if (p.organizationId !== org.id) {
              rows.push({
                contextOrganizationId: org.id,
                contextOrganizationName: org.name,
                project: p,
                isArchived: true,
                hostOrganizationName: nameById.get(p.organizationId) ?? null,
              });
            }
          }
        }
      }
      setSharedProjects(rows);
    } catch {
      setOrganizations([]);
      setInvitations([]);
      setSharedProjects([]);
      useAppStore.getState().setShowOrgMessagesTab(false);
    } finally {
      setSharedProjectsLoading(false);
    }
  }, [user]);

  const fetchDeletionImpact = useCallback(async () => {
    if (!user) return;
    setDeletionImpactLoading(true);
    try {
      const data = await mfGoUser.myAccountDeletionImpact();
      setDeletionImpact(data);
    } catch {
      setDeletionImpact(null);
    } finally {
      setDeletionImpactLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!isLoading && profile && !profile.nickname?.trim()) {
      setShowSetUsernameSheet(true);
    }
  }, [isLoading, profile]);

  useEffect(() => {
    if (user && !isLoading) {
      fetchOrganizations();
      void fetchDeletionImpact();
    }
  }, [user, isLoading, fetchOrganizations, fetchDeletionImpact]);

  const updateProfile = useCallback(
    async (input: UpdateProfileFields) => {
      if (!user) return;
      try {
        const updated = await mfGoUser.updateProfile(input);
        setProfile(updated);
        setUser({
          id: user.id,
          email: updated.email ?? user.email,
          name: updated.displayName,
          avatar: updated.avatarURL || undefined,
          createdAt: user.createdAt,
          updatedAt: new Date(),
        });
        return null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('NICKNAME_TAKEN')) {
          return t('profile.setNickname.taken');
        }
        if (msg.includes('EMAIL_TAKEN')) {
          return t('profile.account.emailTaken');
        }
        if (msg.includes('VALIDATION_ERROR') && msg.toLowerCase().includes('email')) {
          return t('profile.account.emailInvalid');
        }
        return getGraphQLErrorMessage(e);
      }
    },
    [user, setUser]
  );

  const updateSignInEmail = useCallback(
    async (newEmail: string, verifiedEmailChangeOtpId: string) => {
      if (!user) return t('profile.addresses.errorNotAuthenticated');
      const trimmed = newEmail.trim();
      const oldEmail = user.email ?? '';
      try {
        const updated = await mfGoUser.updateProfile({
          email: trimmed,
          emailChangeOtpId: verifiedEmailChangeOtpId,
        });
        setProfile(updated);
        setUser({
          id: user.id,
          email: updated.email ?? trimmed,
          name: updated.displayName,
          avatar: updated.avatarURL || undefined,
          createdAt: user.createdAt,
          updatedAt: new Date(),
        });
        if (oldEmail.toLowerCase() !== (updated.email ?? trimmed).toLowerCase()) {
          const hadSaved = await authCredentials.getSavedPassword(oldEmail);
          if (hadSaved) {
            await authCredentials.clearSavedPassword();
          }
        }
        await authCredentials.setLastEmail(updated.email ?? trimmed);
        return null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('EMAIL_TAKEN')) {
          return t('profile.account.emailTaken');
        }
        if (msg.includes('EMAIL_CHANGE_OTP_REQUIRED')) {
          return t('profile.account.emailOtpRequired');
        }
        if (msg.includes('EMAIL_CHANGE_OTP_INVALID')) {
          return t('profile.account.emailOtpInvalid');
        }
        if (msg.includes('EMAIL_CHANGE_OTP_EXPIRED')) {
          return t('profile.account.emailOtpExpired');
        }
        if (msg.includes('VALIDATION_ERROR')) {
          return t('profile.account.emailInvalid');
        }
        return getGraphQLErrorMessage(e);
      }
    },
    [user, setUser]
  );

  const createOrganization = useCallback(async (name: string) => {
    try {
      const org = await mfGoOrganizations.createOrganization(name);
      setOrganizations((prev) => [org, ...prev]);
      useAppStore.getState().setShowOrgMessagesTab(true);
      void fetchDeletionImpact();
      return null;
    } catch (e) {
      return getGraphQLErrorMessage(e);
    }
  }, [fetchDeletionImpact]);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    try {
      await mfGoOrganizations.acceptInvitation(invitationId);
      await fetchOrganizations();
      void fetchDeletionImpact();
      return null;
    } catch (e) {
      return getGraphQLErrorMessage(e);
    }
  }, [fetchOrganizations, fetchDeletionImpact]);

  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      await mfGoOrganizations.declineInvitation(invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      return null;
    } catch (e) {
      return getGraphQLErrorMessage(e);
    }
  }, []);

  const setNicknameComplete = useCallback(
    async (nickname: string) => {
      if (!user) return t('errors.notSignedIn');
      try {
        const updated = await mfGoUser.updateProfile({ nickname: nickname.trim() });
        setProfile(updated);
        setShowSetUsernameSheet(false);
        return null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('NICKNAME_TAKEN')) {
          return t('profile.setNickname.taken');
        }
        return getGraphQLErrorMessage(e);
      }
    },
    [user]
  );

  const navigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  const navigateToSettings = useCallback(() => {
    router.push('/settings');
  }, []);

  const navigateToResetPassword = useCallback(() => {
    const e = (profile?.email ?? user?.email ?? '').trim();
    if (!e) return;
    router.push({
      pathname: '/forgot-password',
      params: { email: e },
    });
  }, [profile?.email, user?.email]);

  const navigateToArchivedItems = useCallback(() => {
    router.push('/profile/archived-items');
  }, []);

  const navigateToOrganization = useCallback((org: OrganizationPayload) => {
    router.push(`/organization/${org.id}`);
  }, []);

  const navigateToSharedProject = useCallback((contextOrganizationId: string, projectId: string) => {
    router.push(`/organization/${contextOrganizationId}/project/${projectId}` as never);
  }, []);

  /** Permanently removes the account on the server, then clears local session (no server logout — user row is gone). */
  const deleteAccount = useCallback(async () => {
    if (!user) return t('profile.addresses.errorNotAuthenticated');
    try {
      await mfGoUser.deleteAccount();
      const emailToKeep = user.email ?? '';
      if (emailToKeep) {
        await authCredentials.setLastEmail(emailToKeep);
        await authCredentials.clearSavedPassword();
      }
      resetUserMessageSubscriptionClient();
      useAppStore.getState().logout();
      syncMfGoAuthToken(null);
      return null;
    } catch (e) {
      return getGraphQLErrorMessage(e);
    }
  }, [user]);

  const addresses = profile?.addresses ?? [];

  return {
    user,
    profile,
    addresses,
    saveAddress,
    deleteAddress,
    organizations,
    sharedProjects,
    sharedProjectsLoading,
    invitations,
    isLoading,
    error,
    showCreateOrgSheet,
    setShowCreateOrgSheet,
    showSetUsernameSheet,
    setNicknameComplete,
    fetchProfile,
    deletionImpact,
    deletionImpactLoading,
    fetchDeletionImpact,
    fetchOrganizations,
    updateProfile,
    updateSignInEmail,
    createOrganization,
    acceptInvitation,
    declineInvitation,
    navigateBack,
    navigateToSettings,
    navigateToResetPassword,
    navigateToArchivedItems,
    navigateToOrganization,
    navigateToSharedProject,
    deleteAccount,
  };
}
