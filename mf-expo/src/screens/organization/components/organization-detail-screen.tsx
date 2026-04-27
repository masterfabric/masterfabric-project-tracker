/**
 * Organization detail — business card, news, members (with admin actions), team chat.
 */

import { AdaptiveKeyboardAvoidingView } from '@/src/shared/components';
import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import {
  MessageBottomSheet,
  okSheetAction,
  type MessageSheetAction,
} from '@/src/shared/components/MessageBottomSheet';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { t } from '@/src/shared/i18n';
import { mfGoOrganizations } from '@/src/shared/services/mf-go-api';
import type {
  OrganizationInvitationPayload,
  OrganizationMemberPayload,
  OrganizationNewsPayload,
  OrganizationPayload,
} from '@/src/shared/services/mf-go-api';
import { useAppStore } from '@/src/shared/store';
import { themedTextInputProps } from '@/src/shared/utils/themed-text-input';
import { foregroundOnTint } from '@/src/shared/utils/tint-contrast';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InviteToOrganizationSheet } from './invite-to-organization-sheet';
import {
  OrganizationDetailInviteListSkeletonRows,
  OrganizationDetailMemberListSkeletonRows,
  OrganizationDetailScreenSkeleton,
} from './organization-detail-screen-skeleton';
import { OrganizationInvitationActionsSheet } from './organization-invitation-actions-sheet';
import { LeaveOrganizationConfirmSheet, OwnerCannotLeaveSheet } from './leave-organization-sheets';
import { orgDetailLayoutStyles as layout } from './organization-detail-layout.styles';
import { OrganizationMemberManageSheet } from './organization-member-manage-sheet';
import { snackbarService } from '@/src/shared/services/snackbar-service';

/** Single-line org ID card: first 3 characters, then masked tail (UUID-style grouping). */
function formatObscuredOrganizationIdCard(id: string): string {
  const s = id.trim();
  if (s.length < 3) return s;
  return `${s.slice(0, 3)}-***-************`;
}

/** Minimum time the loading skeleton stays visible so fast networks still show it (ms). */
const MIN_ORG_DETAIL_SKELETON_MS = 450;
/** Minimum time pull-to-refresh stays active so skeleton + spinner are noticeable (ms). */
const MIN_ORG_DETAIL_REFRESH_MS = 600;

interface OrganizationDetailScreenProps {
  organizationId: string;
}

export function OrganizationDetailScreen({ organizationId }: OrganizationDetailScreenProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const onTint = foregroundOnTint(isDark);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetMaxH = Math.round(
    Math.min(winH * Sizing.modal.sheetMaxHeightFraction, winH - Math.max(insets.top, 8))
  );
  const user = useAppStore((s) => s.user);

  const [organization, setOrganization] = useState<OrganizationPayload | null>(null);
  const [members, setMembers] = useState<OrganizationMemberPayload[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitationPayload[]>([]);
  const [news, setNews] = useState<OrganizationNewsPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLogoURL, setEditLogoURL] = useState('');
  const [editWebsiteURL, setEditWebsiteURL] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsDescription, setNewsDescription] = useState('');
  const [newsImageURL, setNewsImageURL] = useState('');
  const [newsRich, setNewsRich] = useState('');
  const [savingNews, setSavingNews] = useState(false);
  const [memberToManage, setMemberToManage] = useState<OrganizationMemberPayload | null>(null);
  const [invitationToManage, setInvitationToManage] = useState<OrganizationInvitationPayload | null>(
    null
  );
  const [showLeaveSheet, setShowLeaveSheet] = useState(false);
  const [showOwnerCannotLeave, setShowOwnerCannotLeave] = useState(false);
  const [msgSheet, setMsgSheet] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'success' | 'error';
    primaryAction: MessageSheetAction;
    secondaryAction?: MessageSheetAction;
  } | null>(null);

  const showErrSheet = useCallback((message: string) => {
    setMsgSheet({
      title: t('common.error'),
      message,
      variant: 'error',
      primaryAction: okSheetAction(() => setMsgSheet(null)),
    });
  }, []);

  const fetchData = useCallback(
    async (options?: { mode?: 'initial' | 'refresh' }) => {
      if (!user) return;
      const mode = options?.mode ?? 'initial';
      const loadStartedAt = mode === 'initial' ? Date.now() : 0;
      const refreshStartedAt = mode === 'refresh' ? Date.now() : 0;
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const [org, mems] = await Promise.all([
          mfGoOrganizations.organization(organizationId),
          mfGoOrganizations.organizationMembers(organizationId),
        ]);
        setOrganization(org);
        setMembers(mems);

        const isAdminOrOwner =
          org.ownerUserID === user.id ||
          mems.some((m) => m.userID === user.id && (m.role === 'OWNER' || m.role === 'ADMIN'));

        if (isAdminOrOwner) {
          try {
            const invs = await mfGoOrganizations.organizationInvitations(organizationId);
            setInvitations(invs);
          } catch {
            setInvitations([]);
          }
        } else {
          setInvitations([]);
        }

        try {
          const n = await mfGoOrganizations.organizationNews(organizationId, 30);
          setNews(n);
        } catch {
          setNews([]);
        }
      } catch {
        setOrganization(null);
        setMembers([]);
        setInvitations([]);
        setNews([]);
      } finally {
        if (mode === 'initial') {
          const elapsed = Date.now() - loadStartedAt;
          const remaining = Math.max(0, MIN_ORG_DETAIL_SKELETON_MS - elapsed);
          if (remaining > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, remaining));
          }
          setIsLoading(false);
        } else {
          const elapsed = Date.now() - refreshStartedAt;
          const remaining = Math.max(0, MIN_ORG_DETAIL_REFRESH_MS - elapsed);
          if (remaining > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, remaining));
          }
          setIsRefreshing(false);
        }
      }
    },
    [organizationId, user]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEditOrg = useCallback(() => {
    if (!organization) return;
    setEditName(organization.name);
    setEditDescription(organization.description ?? '');
    setEditLogoURL(organization.logoURL ?? '');
    setEditWebsiteURL(organization.websiteURL ?? '');
    setEditContactEmail(organization.contactEmail ?? '');
    setShowEditOrg(true);
  }, [organization]);

  const saveEditOrg = useCallback(async () => {
    if (!organization) return;
    setSavingOrg(true);
    try {
      const updated = await mfGoOrganizations.updateOrganization({
        organizationId: organization.id,
        name: editName.trim() || undefined,
        description: editDescription,
        logoURL: editLogoURL,
        websiteURL: editWebsiteURL,
        contactEmail: editContactEmail,
      });
      setOrganization(updated);
      setShowEditOrg(false);
    } catch {
      showErrSheet(t('profile.organizations.detail.saveOrgFailed'));
    } finally {
      setSavingOrg(false);
    }
  }, [organization, editName, editDescription, editLogoURL, editWebsiteURL, editContactEmail, showErrSheet]);

  const openCreateNews = useCallback(() => {
    setEditingNewsId(null);
    setNewsTitle('');
    setNewsDescription('');
    setNewsImageURL('');
    setNewsRich('');
    setShowNewsModal(true);
  }, []);

  const openEditNews = useCallback((item: OrganizationNewsPayload) => {
    setEditingNewsId(item.id);
    setNewsTitle(item.title);
    setNewsDescription(item.description ?? '');
    setNewsImageURL(item.imageURL ?? '');
    setNewsRich(item.richMetadata ?? '');
    setShowNewsModal(true);
  }, []);

  const saveNews = useCallback(async () => {
    if (!organization) return;
    setSavingNews(true);
    try {
      if (editingNewsId) {
        await mfGoOrganizations.updateOrganizationNews({
          newsId: editingNewsId,
          title: newsTitle.trim() || undefined,
          description: newsDescription,
          imageURL: newsImageURL,
          richMetadata: newsRich.trim() ? newsRich : undefined,
        });
      } else {
        await mfGoOrganizations.createOrganizationNews({
          organizationId: organization.id,
          title: newsTitle.trim(),
          description: newsDescription,
          imageURL: newsImageURL,
          richMetadata: newsRich.trim() ? newsRich : undefined,
        });
      }
      setShowNewsModal(false);
      const n = await mfGoOrganizations.organizationNews(organizationId, 30);
      setNews(n);
    } catch {
      showErrSheet(t('profile.organizations.detail.saveNewsFailed'));
    } finally {
      setSavingNews(false);
    }
  }, [
    organization,
    organizationId,
    editingNewsId,
    newsTitle,
    newsDescription,
    newsImageURL,
    newsRich,
    showErrSheet,
  ]);

  const deleteNewsItem = useCallback(
    (id: string) => {
      setMsgSheet({
        title: t('common.delete'),
        message: t('profile.organizations.detail.deleteNewsConfirm'),
        variant: 'info',
        secondaryAction: {
          label: t('common.cancel'),
          onPress: () => setMsgSheet(null),
        },
        primaryAction: {
          label: t('common.delete'),
          destructive: true,
          onPress: () => {
            setMsgSheet(null);
            void (async () => {
              try {
                await mfGoOrganizations.deleteOrganizationNews(id);
                setNews((prev) => prev.filter((x) => x.id !== id));
              } catch {
                showErrSheet(t('profile.organizations.detail.deleteNewsFailed'));
              }
            })();
          },
        },
      });
    },
    [t, showErrSheet]
  );

  const handleAdminSetSuspended = useCallback(
    async (targetUserId: string, suspended: boolean) => {
      try {
        await mfGoOrganizations.setOrganizationMemberSuspended(
          organizationId,
          targetUserId,
          suspended
        );
        await fetchData({ mode: 'refresh' });
      } catch {
        showErrSheet(t('profile.organizations.detail.memberActionFailed'));
        throw new Error('memberActionFailed');
      }
    },
    [organizationId, fetchData, showErrSheet]
  );

  const handleAdminRemoveMember = useCallback(
    async (targetUserId: string) => {
      try {
        await mfGoOrganizations.removeOrganizationMember(organizationId, targetUserId);
        await fetchData({ mode: 'refresh' });
      } catch {
        showErrSheet(t('profile.organizations.detail.memberActionFailed'));
        throw new Error('memberActionFailed');
      }
    },
    [organizationId, fetchData, showErrSheet]
  );

  const handleInvitationResend = useCallback(
    async (invitationId: string) => {
      try {
        await mfGoOrganizations.resendOrganizationInvitation(invitationId);
        await fetchData({ mode: 'refresh' });
      } catch {
        showErrSheet(t('profile.organizations.detail.invitationActionFailed'));
        throw new Error('invitationActionFailed');
      }
    },
    [fetchData, showErrSheet]
  );

  const handleInvitationRevoke = useCallback(
    async (invitationId: string) => {
      try {
        await mfGoOrganizations.revokeOrganizationInvitation(invitationId);
        await fetchData({ mode: 'refresh' });
      } catch {
        showErrSheet(t('profile.organizations.detail.invitationActionFailed'));
        throw new Error('invitationActionFailed');
      }
    },
    [fetchData, showErrSheet]
  );

  const handleInvite = useCallback(
    async (email: string) => {
      try {
        await mfGoOrganizations.inviteToOrganization(organizationId, email);
        await fetchData({ mode: 'refresh' });
        return null;
      } catch (e) {
        return getGraphQLErrorMessage(e);
      }
    },
    [organizationId, fetchData]
  );

  const navigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  }, []);

  const confirmLeaveOrganization = useCallback(async () => {
    try {
      await mfGoOrganizations.leaveOrganization(organizationId);
      navigateBack();
    } catch {
      showErrSheet(t('profile.organizations.detail.leaveOrganizationFailed'));
      throw new Error('leaveFailed');
    }
  }, [organizationId, navigateBack, showErrSheet]);

  const onMemberRowPress = useCallback(
    (m: OrganizationMemberPayload) => {
      if (!user || !organization) return;
      const rowIsOwner = organization.ownerUserID === user.id;
      const rowIsAdminOrOwner =
        rowIsOwner ||
        members.some((x) => x.userID === user.id && (x.role === 'OWNER' || x.role === 'ADMIN'));
      const isSelf = m.userID === user.id;
      const canAdminTarget = rowIsAdminOrOwner && !isSelf && m.role !== 'OWNER';
      if (isSelf) {
        if (rowIsOwner) {
          setShowOwnerCannotLeave(true);
          return;
        }
        setShowLeaveSheet(true);
        return;
      }
      if (canAdminTarget) {
        setMemberToManage(m);
      }
    },
    [user, organization, members]
  );

  const openTeamChat = useCallback(() => {
    router.push(
      `/(tabs)/org-messages?orgId=${encodeURIComponent(organizationId)}` as unknown as Parameters<
        typeof router.push
      >[0]
    );
  }, [organizationId]);

  const openProjects = useCallback(() => {
    router.push(`/organization/${organizationId}/projects` as never);
  }, [organizationId]);

  const copyOrganizationIdToClipboard = useCallback(() => {
    try {
      Clipboard.setString(organizationId);
      snackbarService.success(t('profile.organizations.detail.organizationIdCopied'), 2200);
    } catch {
      snackbarService.error(t('profile.organizations.detail.organizationIdCopyFailed'), 2800);
    }
  }, [organizationId, t]);

  const sectionHeaderColor = isDark ? '#8E8E93' : '#6D6D72';
  const rowBg = isDark ? '#1C1C1E' : '#FFFFFF';

  if (!user) {
    return null;
  }

  const isOwner = organization?.ownerUserID === user.id;
  const isAdminOrOwner =
    !!organization &&
    (isOwner ||
      members.some((m) => m.userID === user.id && (m.role === 'OWNER' || m.role === 'ADMIN')));

  const getInvitationStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return t('profile.organizations.detail.statusPending');
      case 'ACCEPTED':
        return t('profile.organizations.detail.statusAccepted');
      case 'DECLINED':
        return t('profile.organizations.detail.statusDeclined');
      case 'REVOKED':
      case 'revoked':
        return t('profile.organizations.detail.statusRevoked');
      default:
        return status;
    }
  };

  const textInputTheme = themedTextInputProps(colors, isDark);
  const inputStyle = [
    styles.sheetInput,
    {
      borderColor: colors.surfaceBorder,
      color: colors.bodyText,
      backgroundColor: colors.surfaceBackground,
    },
  ];
  const sheetScrollMax = Math.min(Sizing.modal.sheetScrollMaxHeight, sheetMaxH * 0.62);

  return (
    <>
      <AppBarScaffold
        style={styles.container}
        backgroundColor={colors.settingsBackground}
        appBar={
          <ScreenHeader
            title={organization?.name ?? t('profile.organizations.detail.title')}
            subtitle={t('profile.organizations.detail.subtitle')}
            onBackPress={navigateBack}
            showBackButton
            variant="minimal"
            rightAction={
              isAdminOrOwner && organization ? (
                <Pressable
                  onPress={() => setShowInviteSheet(true)}
                  style={({ pressed }) => [
                    styles.inviteButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.organizations.invite.title')}
                >
                  <Ionicons name="person-add-outline" size={22} color={colors.tint} />
                </Pressable>
              ) : undefined
            }
          />
        }
      >
        {isLoading ? (
            <View style={styles.skeletonHost}>
              <OrganizationDetailScreenSkeleton />
            </View>
          ) : !organization ? (
            <View style={[styles.emptyContainer, { paddingTop: 24 }]}>
              <Text style={[styles.emptyText, { color: colors.labelText }]}>
                {t('profile.organizations.detail.notFound')}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={layout.content}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={layout.contentContainer}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => fetchData({ mode: 'refresh' })}
                  tintColor={colors.tint}
                  colors={[colors.tint]}
                />
              }
            >
              {organization.logoURL?.trim() ? (
                <View style={layout.orgLogoSection} accessibilityRole="image">
                  <View style={[layout.orgLogoClip, { backgroundColor: rowBg }]}>
                    <Image
                      source={{ uri: organization.logoURL.trim() }}
                      style={layout.orgLogoImage}
                      resizeMode="cover"
                      accessibilityLabel={t('profile.organizations.detail.orgLogoA11y', {
                        name: organization.name,
                      })}
                    />
                  </View>
                </View>
              ) : null}
              <Text style={[layout.sectionHeader, { color: sectionHeaderColor }]}>
                {t('profile.organizations.detail.businessCard').toUpperCase()}
              </Text>
              <View style={[layout.groupedSection, { backgroundColor: rowBg }]}>
                {organization.description?.trim() ? (
                  <View style={layout.cardBlock}>
                    <Text style={[layout.cardBody, { color: colors.bodyText }]}>
                      {organization.description}
                    </Text>
                  </View>
                ) : null}
                {organization.websiteURL?.trim() ? (
                  <Pressable
                    onPress={() => Linking.openURL(organization.websiteURL)}
                    style={layout.cardRow}
                  >
                    <Text style={[layout.cardLabel, { color: colors.labelText }]}>
                      {t('profile.organizations.detail.website')}
                    </Text>
                    <Text style={[layout.cardLink, { color: colors.tint }]} numberOfLines={1}>
                      {organization.websiteURL}
                    </Text>
                  </Pressable>
                ) : null}
                {organization.contactEmail?.trim() ? (
                  <View style={layout.cardRow}>
                    <Text style={[layout.cardLabel, { color: colors.labelText }]}>
                      {t('profile.organizations.detail.contactEmail')}
                    </Text>
                    <Text style={[layout.cardBody, { color: colors.bodyText }]} numberOfLines={2}>
                      {organization.contactEmail}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={copyOrganizationIdToClipboard}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.organizations.detail.organizationIdCopyA11y')}
                  accessibilityHint={t('profile.organizations.detail.organizationIdTapHint')}
                  style={({ pressed }) => [
                    layout.cardRow,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      opacity: pressed ? 0.75 : 1,
                      borderTopWidth:
                        organization.description?.trim() ||
                        organization.websiteURL?.trim() ||
                        organization.contactEmail?.trim()
                          ? StyleSheet.hairlineWidth
                          : 0,
                      borderTopColor: isDark ? '#38383A' : '#C6C6C8',
                    },
                  ]}
                >
                  <Text
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 15,
                      fontWeight: '600',
                      letterSpacing: 0.4,
                      color: colors.bodyText,
                      fontVariant: ['tabular-nums'],
                    }}
                    numberOfLines={1}
                    selectable={false}
                  >
                    {formatObscuredOrganizationIdCard(organization.id)}
                  </Text>
                  <Ionicons name="copy-outline" size={22} color={colors.tint} style={{ flexShrink: 0 }} />
                </Pressable>
              </View>

              {isAdminOrOwner ? (
                <Pressable
                  onPress={openEditOrg}
                  style={({ pressed }) => [
                    layout.secondaryRow,
                    { backgroundColor: rowBg, opacity: pressed ? 0.7 : 1, marginTop: 12 },
                  ]}
                >
                  <Ionicons name="create-outline" size={22} color={colors.tint} />
                  <Text style={[layout.secondaryRowText, { color: colors.tint }]}>
                    {t('profile.organizations.detail.editProfile')}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={openTeamChat}
                style={({ pressed }) => [
                  layout.secondaryRow,
                  {
                    backgroundColor: rowBg,
                    opacity: pressed ? 0.7 : 1,
                    marginTop: isAdminOrOwner ? 10 : 12,
                  },
                ]}
              >
                <Ionicons name="chatbubbles-outline" size={22} color={colors.tint} />
                <Text style={[layout.secondaryRowText, { color: colors.tint }]}>
                  {t('profile.organizations.detail.teamChat')}
                </Text>
                <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
              </Pressable>

              <Pressable
                onPress={openProjects}
                style={({ pressed }) => [
                  layout.secondaryRow,
                  {
                    backgroundColor: rowBg,
                    opacity: pressed ? 0.7 : 1,
                    marginTop: 10,
                  },
                ]}
              >
                <Ionicons name="folder-outline" size={22} color={colors.tint} />
                <Text style={[layout.secondaryRowText, { color: colors.tint }]}>
                  {t('profile.organizations.detail.projects')}
                </Text>
                <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
              </Pressable>

              <View style={layout.newsHeaderRow}>
                <Text style={[layout.sectionHeader, { color: sectionHeaderColor, marginTop: 0 }]}>
                  {t('profile.organizations.detail.news').toUpperCase()}
                </Text>
                {isOwner ? (
                  <Pressable onPress={openCreateNews} hitSlop={8}>
                    <Text style={{ color: colors.tint, fontWeight: '600' }}>
                      {t('profile.organizations.detail.addNews')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {news.length === 0 ? (
                <Text style={[layout.muted, { color: colors.labelText }]}>
                  {t('profile.organizations.detail.noNews')}
                </Text>
              ) : (
                <View style={[layout.groupedSection, { backgroundColor: rowBg }]}>
                  {news.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        layout.newsItem,
                        index < news.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[layout.newsTitle, { color: colors.bodyText }]}>
                          {item.title}
                        </Text>
                        {item.description?.trim() ? (
                          <Text
                            style={[layout.newsDesc, { color: colors.labelText }]}
                            numberOfLines={4}
                          >
                            {item.description}
                          </Text>
                        ) : null}
                        <Text style={[layout.newsMeta, { color: colors.labelText }]}>
                          @{item.authorNickname || item.authorUserID.slice(0, 8)}
                        </Text>
                      </View>
                      {isOwner ? (
                        <View style={layout.newsActions}>
                          <Pressable onPress={() => openEditNews(item)} hitSlop={8}>
                            <Ionicons name="pencil" size={20} color={colors.tint} />
                          </Pressable>
                          <Pressable onPress={() => deleteNewsItem(item.id)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={20} color="#C00" />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              <Text
                style={[
                  layout.sectionHeader,
                  layout.memberSectionTitle,
                  { color: sectionHeaderColor },
                ]}
              >
                {t('profile.organizations.detail.members').toUpperCase()}
              </Text>
              <View style={[layout.groupedSection, layout.memberGroupedSection, { backgroundColor: rowBg }]}>
                {isRefreshing ? (
                  <OrganizationDetailMemberListSkeletonRows
                    rowCount={Math.max(4, members.length)}
                  />
                ) : members.length === 0 ? (
                  <View style={layout.memberRow}>
                    <Text style={[layout.emptyRowText, { color: colors.labelText }]}>
                      {t('profile.organizations.detail.noMembers')}
                    </Text>
                  </View>
                ) : (
                  members.map((m, index) => {
                    const isSelf = m.userID === user.id;
                    const canAdminTarget =
                      isAdminOrOwner && !isSelf && m.role !== 'OWNER';
                    const rowInteractive =
                      canAdminTarget || isSelf;
                    const trailingIcon = canAdminTarget ? (
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.icon} />
                    ) : isSelf && !isOwner ? (
                      <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
                    ) : isSelf && isOwner ? (
                      <Ionicons name="information-circle-outline" size={22} color={colors.icon} />
                    ) : null;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => onMemberRowPress(m)}
                        disabled={!rowInteractive}
                        style={[
                          layout.memberRow,
                          index < members.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                          },
                        ]}
                      >
                        <View style={[layout.memberAvatar, { backgroundColor: colors.tint + '20' }]}>
                          <Text style={[layout.memberInitials, { color: colors.tint }]}>
                            {(m.userNickname || m.userID).slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={layout.memberInfo}>
                          <Text style={[layout.memberId, { color: colors.bodyText }]}>
                            {m.userNickname?.trim() || `@${m.userID.slice(0, 8)}…`}
                          </Text>
                          <Text style={[layout.memberRole, { color: colors.labelText }]}>
                            {m.role}
                            {m.membershipStatus === 'SUSPENDED'
                              ? ` · ${t('profile.organizations.detail.memberPassive')}`
                              : ''}
                          </Text>
                        </View>
                        {trailingIcon}
                      </Pressable>
                    );
                  })
                )}
              </View>

              {isAdminOrOwner && (invitations.length > 0 || isRefreshing) && (
                <>
                  <Text
                    style={[
                      layout.sectionHeader,
                      layout.invitationsSectionTitle,
                      { color: sectionHeaderColor },
                    ]}
                  >
                    {t('profile.organizations.detail.sentInvitations').toUpperCase()}
                  </Text>
                  <View style={[layout.groupedSection, layout.memberGroupedSection, { backgroundColor: rowBg }]}>
                    {isRefreshing ? (
                      <OrganizationDetailInviteListSkeletonRows
                        rowCount={Math.max(2, invitations.length)}
                      />
                    ) : (
                      invitations.map((inv, index) => {
                      const isPending = inv.status === 'PENDING';
                      const RowWrapper = isPending ? Pressable : View;
                      return (
                        <RowWrapper
                          key={inv.id}
                          onPress={isPending ? () => setInvitationToManage(inv) : undefined}
                          disabled={!isPending}
                          style={[
                            layout.memberRow,
                            index < invitations.length - 1 && {
                              borderBottomWidth: 1,
                              borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
                            },
                          ]}
                        >
                          <View style={layout.memberInfo}>
                            <Text style={[layout.memberId, { color: colors.bodyText }]}>
                              {inv.inviteeEmail}
                            </Text>
                            <Text style={[layout.memberRole, { color: colors.labelText }]}>
                              {getInvitationStatusLabel(inv.status)}
                            </Text>
                          </View>
                          {isPending ? (
                            <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
                          ) : null}
                        </RowWrapper>
                      );
                    })
                    )}
                  </View>
                </>
              )}

              {isAdminOrOwner && (
                <Pressable
                  onPress={() => setShowInviteSheet(true)}
                  disabled={isRefreshing}
                  style={({ pressed }) => [
                    layout.inviteRow,
                    {
                      backgroundColor: rowBg,
                      opacity: isRefreshing ? 0.5 : pressed ? 0.6 : 1,
                      marginTop: 12,
                    },
                  ]}
                >
                  <Ionicons name="person-add-outline" size={24} color={colors.tint} />
                  <Text style={[layout.inviteRowText, { color: colors.tint }]}>
                    {t('profile.organizations.invite.title')}
                  </Text>
                  <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
                </Pressable>
              )}
            </ScrollView>
          )}
      </AppBarScaffold>

      <InviteToOrganizationSheet
        visible={showInviteSheet}
        organizationName={organization?.name ?? ''}
        onClose={() => setShowInviteSheet(false)}
        onInvite={handleInvite}
      />

      <OrganizationInvitationActionsSheet
        visible={!!invitationToManage}
        invitation={invitationToManage}
        organizationName={organization?.name ?? ''}
        onClose={() => setInvitationToManage(null)}
        onResend={handleInvitationResend}
        onRevoke={handleInvitationRevoke}
      />

      <OrganizationMemberManageSheet
        visible={!!memberToManage}
        member={memberToManage}
        organizationName={organization?.name ?? ''}
        onClose={() => setMemberToManage(null)}
        onSetSuspended={handleAdminSetSuspended}
        onRemove={handleAdminRemoveMember}
      />

      <LeaveOrganizationConfirmSheet
        visible={showLeaveSheet}
        organizationName={organization?.name ?? ''}
        onClose={() => setShowLeaveSheet(false)}
        onConfirmLeave={confirmLeaveOrganization}
      />

      <OwnerCannotLeaveSheet
        visible={showOwnerCannotLeave}
        onClose={() => setShowOwnerCannotLeave(false)}
      />

      <Modal
        visible={showEditOrg}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => !savingOrg && setShowEditOrg(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={savingOrg ? undefined : () => setShowEditOrg(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <AdaptiveKeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetKeyboardView}
          >
            <Pressable
              style={[
                styles.sheetPanel,
                {
                  maxHeight: sheetMaxH,
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceBorder,
                  paddingBottom: Math.max(insets.bottom, Sizing.padding.l),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Pressable
                onPress={() => !savingOrg && setShowEditOrg(false)}
                disabled={savingOrg}
                hitSlop={12}
                style={styles.sheetCloseButton}
                accessibilityLabel={t('accessibility.closeModal')}
              >
                <Ionicons name="close" size={24} color={colors.bodyText} />
              </Pressable>
              <Text style={[styles.sheetHeadline, { color: colors.bodyText }]}>
                {t('profile.organizations.detail.editProfile')}
              </Text>
              <ScrollView
                style={{ maxHeight: sheetScrollMax }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <TextInput
                  {...textInputTheme}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Name"
                  style={inputStyle}
                />
                <TextInput
                  {...textInputTheme}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Description"
                  style={[inputStyle, styles.multiline]}
                  multiline
                />
                <TextInput
                  {...textInputTheme}
                  value={editLogoURL}
                  onChangeText={setEditLogoURL}
                  placeholder="Logo URL"
                  style={inputStyle}
                  autoCapitalize="none"
                />
                <TextInput
                  {...textInputTheme}
                  value={editWebsiteURL}
                  onChangeText={setEditWebsiteURL}
                  placeholder="Website"
                  style={inputStyle}
                  autoCapitalize="none"
                />
                <TextInput
                  {...textInputTheme}
                  value={editContactEmail}
                  onChangeText={setEditContactEmail}
                  placeholder="Contact email"
                  style={inputStyle}
                  autoCapitalize="none"
                />
              </ScrollView>
              <View style={styles.sheetActionsRow}>
                <Pressable
                  onPress={() => setShowEditOrg(false)}
                  disabled={savingOrg}
                  style={({ pressed }) => [
                    styles.sheetSecondaryButton,
                    {
                      borderColor: colors.surfaceBorder,
                      backgroundColor: colors.surface,
                      opacity: savingOrg ? 0.5 : pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.sheetSecondaryButtonText, { color: colors.bodyText }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={saveEditOrg}
                  disabled={savingOrg}
                  style={({ pressed }) => [
                    styles.sheetPrimaryButton,
                    {
                      backgroundColor: colors.tint,
                      opacity: savingOrg ? 0.5 : pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  {savingOrg ? (
                    <ActivityIndicator color={onTint} />
                  ) : (
                    <Text style={[styles.sheetPrimaryButtonText, { color: onTint }]}>
                      {t('profile.organizations.detail.saveDetails')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </AdaptiveKeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={showNewsModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => !savingNews && setShowNewsModal(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={savingNews ? undefined : () => setShowNewsModal(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <AdaptiveKeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetKeyboardView}
          >
            <Pressable
              style={[
                styles.sheetPanel,
                {
                  maxHeight: sheetMaxH,
                  backgroundColor: colors.background,
                  borderColor: colors.surfaceBorder,
                  paddingBottom: Math.max(insets.bottom, Sizing.padding.l),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Pressable
                onPress={() => !savingNews && setShowNewsModal(false)}
                disabled={savingNews}
                hitSlop={12}
                style={styles.sheetCloseButton}
                accessibilityLabel={t('accessibility.closeModal')}
              >
                <Ionicons name="close" size={24} color={colors.bodyText} />
              </Pressable>
              <Text style={[styles.sheetHeadline, { color: colors.bodyText }]}>
                {editingNewsId
                  ? t('profile.organizations.detail.editNews')
                  : t('profile.organizations.detail.addNews')}
              </Text>
              <ScrollView
                style={{ maxHeight: sheetScrollMax }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <TextInput
                  {...textInputTheme}
                  value={newsTitle}
                  onChangeText={setNewsTitle}
                  placeholder={t('profile.organizations.detail.newsTitle')}
                  style={inputStyle}
                />
                <TextInput
                  {...textInputTheme}
                  value={newsDescription}
                  onChangeText={setNewsDescription}
                  placeholder={t('profile.organizations.detail.newsDescription')}
                  style={[inputStyle, styles.multiline]}
                  multiline
                />
                <TextInput
                  {...textInputTheme}
                  value={newsImageURL}
                  onChangeText={setNewsImageURL}
                  placeholder={t('profile.organizations.detail.newsImageUrl')}
                  style={inputStyle}
                  autoCapitalize="none"
                />
                <TextInput
                  {...textInputTheme}
                  value={newsRich}
                  onChangeText={setNewsRich}
                  placeholder={t('profile.organizations.detail.newsRichMetadata')}
                  style={[inputStyle, styles.multiline]}
                  multiline
                />
              </ScrollView>
              <View style={styles.sheetActionsRow}>
                <Pressable
                  onPress={() => setShowNewsModal(false)}
                  disabled={savingNews}
                  style={({ pressed }) => [
                    styles.sheetSecondaryButton,
                    {
                      borderColor: colors.surfaceBorder,
                      backgroundColor: colors.surface,
                      opacity: savingNews ? 0.5 : pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.sheetSecondaryButtonText, { color: colors.bodyText }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={saveNews}
                  disabled={savingNews || !newsTitle.trim()}
                  style={({ pressed }) => [
                    styles.sheetPrimaryButton,
                    {
                      backgroundColor: colors.tint,
                      opacity: savingNews || !newsTitle.trim() ? 0.5 : pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  {savingNews ? (
                    <ActivityIndicator color={onTint} />
                  ) : (
                    <Text style={[styles.sheetPrimaryButtonText, { color: onTint }]}>
                      {t('common.save')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </AdaptiveKeyboardAvoidingView>
        </Pressable>
      </Modal>

      {msgSheet ? (
        <MessageBottomSheet
          visible
          onDismiss={() => setMsgSheet(null)}
          title={msgSheet.title}
          message={msgSheet.message}
          variant={msgSheet.variant}
          primaryAction={msgSheet.primaryAction}
          secondaryAction={msgSheet.secondaryAction}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonHost: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  inviteButton: { padding: 8, marginRight: -8 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    ...(Platform.OS === 'android' && { elevation: 999 }),
  },
  sheetKeyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetPanel: {
    width: '100%',
    alignSelf: 'flex-end',
    overflow: 'hidden',
    borderTopLeftRadius: Sizing.modal.sheetTopCornerRadius,
    borderTopRightRadius: Sizing.modal.sheetTopCornerRadius,
    borderBottomLeftRadius: Sizing.modal.sheetBottomCornerRadius,
    borderBottomRightRadius: Sizing.modal.sheetBottomCornerRadius,
    paddingHorizontal: Sizing.padding.xl,
    paddingTop: Sizing.padding.m,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    ...(Platform.OS === 'android' && { elevation: 1000 }),
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: Sizing.padding.l,
  },
  sheetCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 1,
    padding: 6,
  },
  sheetHeadline: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: Sizing.padding.m,
    paddingRight: 40,
  },
  sheetInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Sizing.padding.m,
  },
  sheetSecondaryButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  sheetSecondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  sheetPrimaryButton: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  sheetPrimaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
