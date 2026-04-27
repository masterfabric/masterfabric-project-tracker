import { t } from '@/src/shared/i18n';
import { OwnerDashboardEntryCard } from '@/src/screens/organization';
import { SOFT_CARD_RADIUS, cardShadowStyle } from '@/src/shared/ui/screen-card-styles';
import { useAppStore } from '@/src/shared/store';
import type {
  UserProfile,
  UserAddress,
  OrganizationPayload,
  OrganizationInvitationPayload,
  UpsertAddressInput,
  MyAccountDeletionImpact,
} from '@/src/shared/services/mf-go-api';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, Sizing, useTheme } from 'masterfabric-expo-core';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { profileStyles as styles } from '../styles/profile-styles';
import { EditProfileSheet } from './edit-profile-sheet';
import { EditEmailSheet } from './edit-email-sheet';
import { CreateOrganizationSheet } from './create-organization-sheet';
import { SetUsernameSheet } from './set-username-sheet';
import { ManageAddressSheet } from './manage-address-sheet';
import { MessageBottomSheet, okSheetAction } from '@/src/shared/components/MessageBottomSheet';
import { ConfirmationBottomSheet } from './confirmation-bottom-sheet';
import {
  DeleteAccountImpactBadgeStrip,
  DeleteAccountImpactList,
} from './delete-account-impact-list';
import type {
  ProfileSharedProjectEntry,
  UpdateProfileFields,
} from '../hooks/use-profile-view-model';

function ProfileElevated({
  isDark,
  rowBg,
  children,
}: {
  isDark: boolean;
  rowBg: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[{ borderRadius: SOFT_CARD_RADIUS, marginBottom: 12 }, cardShadowStyle(isDark)]}
    >
      <View
        style={{
          borderRadius: SOFT_CARD_RADIUS,
          overflow: 'hidden',
          backgroundColor: rowBg,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '?';
}

function InfoRow({
  icon,
  label,
  value,
  colors,
  isDark,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
  colors: ReturnType<typeof getThemeColors>;
  isDark: boolean;
  onPress?: () => void;
}) {
  if (!value?.trim()) return null;
  const content = (
    <View style={[styles.infoRow, { borderBottomColor: isDark ? '#38383A' : '#C6C6C8' }]}>
      <Ionicons name={icon} size={20} color={colors.labelText} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.labelText }]}>{label}</Text>
        <Text
          style={[styles.infoValue, { color: colors.bodyText }]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {onPress && (
        <Ionicons name="open-outline" size={18} color={colors.tint} />
      )}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

interface ProfileContentProps {
  profile: UserProfile | null;
  organizations: OrganizationPayload[];
  sharedProjects: ProfileSharedProjectEntry[];
  sharedProjectsLoading: boolean;
  invitations: OrganizationInvitationPayload[];
  isLoading: boolean;
  error: string | null;
  showEditSheet: boolean;
  showCreateOrgSheet: boolean;
  onCloseEditSheet: () => void;
  onOpenCreateOrgSheet: () => void;
  onCloseCreateOrgSheet: () => void;
  onFetchProfile: () => void;
  onUpdateProfile: (input: UpdateProfileFields) => Promise<string | null>;
  onUpdateSignInEmail: (email: string, verifiedEmailChangeOtpId: string) => Promise<string | null>;
  onCreateOrganization: (name: string) => Promise<string | null>;
  onAcceptInvitation: (invitationId: string) => Promise<string | null>;
  onDeclineInvitation: (invitationId: string) => Promise<string | null>;
  onSettingsPress: () => void;
  onResetPasswordPress: () => void;
  onOrganizationPress: (org: OrganizationPayload) => void;
  onSharedProjectPress: (contextOrganizationId: string, projectId: string) => void;
  showSetUsernameSheet: boolean;
  onSetNicknameComplete: (nickname: string) => Promise<string | null>;
  addresses: UserAddress[];
  onSaveAddress: (input: UpsertAddressInput) => Promise<string | null>;
  onDeleteAddress: (addressId: string) => Promise<string | null>;
  onDeleteAccount: () => Promise<string | null>;
  deletionImpact: MyAccountDeletionImpact | null;
  deletionImpactLoading: boolean;
  onRefreshDeletionImpact: () => void | Promise<void>;
}

export function ProfileContent({
  profile,
  organizations,
  sharedProjects,
  sharedProjectsLoading,
  invitations,
  isLoading,
  error,
  showEditSheet,
  showCreateOrgSheet,
  onCloseEditSheet,
  onOpenCreateOrgSheet,
  onCloseCreateOrgSheet,
  onFetchProfile,
  onUpdateProfile,
  onUpdateSignInEmail,
  onCreateOrganization,
  onAcceptInvitation,
  onDeclineInvitation,
  onSettingsPress,
  onResetPasswordPress,
  onOrganizationPress,
  onSharedProjectPress,
  showSetUsernameSheet,
  onSetNicknameComplete,
  addresses,
  onSaveAddress,
  onDeleteAddress,
  onDeleteAccount,
  deletionImpact,
  deletionImpactLoading,
  onRefreshDeletionImpact,
}: ProfileContentProps) {
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [deleteAccountSheetOpen, setDeleteAccountSheetOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountErrorMessage, setDeleteAccountErrorMessage] = useState<string | null>(null);
  const [deleteImpactExpanded, setDeleteImpactExpanded] = useState(false);

  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const user = useAppStore((s) => s.user);

  const sectionHeaderColor = isDark ? '#8E8E93' : '#6D6D72';
  const rowBg = isDark ? '#1C1C1E' : '#FFFFFF';

  if (!user) {
    return null;
  }

  const displayName = profile?.displayName || user.name || t('profile.unknownName');
  const email = profile?.email ?? user.email ?? '';
  const avatar = profile?.avatarURL || user.avatar;

  if (isLoading && !profile) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: 24 }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.labelText }]}>
          {t('profile.loading')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: 14 },
      ]}
    >
      <OwnerDashboardEntryCard userId={user.id} organizations={organizations} />
      <View
        style={[
          { borderRadius: SOFT_CARD_RADIUS, overflow: 'hidden', marginBottom: 22 },
          cardShadowStyle(isDark),
        ]}
      >
        <View style={[styles.avatarSection, { backgroundColor: colors.surfaceBackground }]}>
          <View
            style={[
              styles.avatarOuterRing,
              {
                borderColor: isDark ? colors.tint + '7A' : colors.tint + '55',
              },
            ]}
            accessibilityRole="image"
            accessibilityLabel={displayName}
          >
            <View
              style={[
                styles.avatarInnerClip,
                { backgroundColor: colors.headerBackground },
              ]}
            >
              {avatar ? (
                <Image
                  source={{ uri: avatar }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.avatarInitials, { color: colors.tint }]}>
                  {getInitials(displayName)}
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>
          {profile?.nickname?.trim() && (
            <Text style={[styles.userNickname, { color: colors.labelText }]}>
              @{profile.nickname.trim()}
            </Text>
          )}
          {user.role === 'ADMIN' && (
            <View
              style={[
                styles.adminBadge,
                {
                  backgroundColor: colors.tint + '25',
                  borderColor: colors.tint,
                },
              ]}
            >
              <Text style={[styles.adminBadgeText, { color: colors.tint }]}>
                {t('profile.adminBadge')}
              </Text>
            </View>
          )}
          <Text style={[styles.userEmail, { color: colors.labelText }]}>{email}</Text>
        </View>
      </View>

      {invitations.length > 0 && (
        <>
          <Text
            style={[
              styles.sectionHeader,
              styles.sectionHeaderFirst,
              { color: sectionHeaderColor },
            ]}
          >
            {t('profile.organizations.invitations').toUpperCase()}
          </Text>
          <ProfileElevated isDark={isDark} rowBg={rowBg}>
            {invitations.map((inv) => (
              <View
                key={inv.id}
                style={[
                  styles.row,
                  { borderBottomWidth: 1, borderBottomColor: isDark ? '#38383A' : '#C6C6C8' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                    {inv.organizationName?.trim()
                      ? inv.organizationName.trim()
                      : t('profile.organizations.invitationUnknownOrg')}
                  </Text>
                  <Text style={[styles.infoLabel, { color: colors.labelText, fontSize: 13 }]} numberOfLines={2}>
                    {inv.inviterNickname?.trim()
                      ? t('profile.organizations.invitationInvitedBy', {
                          name: inv.inviterNickname.trim(),
                        })
                      : t('profile.organizations.invitation')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => onAcceptInvitation(inv.id)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: colors.tint, fontWeight: '600', fontSize: 15 }}>
                      {t('profile.organizations.accept')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onDeclineInvitation(inv.id)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: colors.labelText, fontSize: 15 }}>
                      {t('profile.organizations.decline')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ProfileElevated>
        </>
      )}

      {(profile?.nickname || profile?.displayName || profile?.bio || profile?.phoneNumber || profile?.location || profile?.websiteURL) && (
        <>
          <Text
            style={[
              styles.sectionHeader,
              styles.sectionHeaderFirst,
              { color: sectionHeaderColor },
            ]}
          >
            {(t('profile.sections.personal') || 'Personal Info').toUpperCase()}
          </Text>
          <ProfileElevated isDark={isDark} rowBg={rowBg}>
            {profile.nickname?.trim() && (
              <View style={[styles.infoRow, { borderBottomColor: isDark ? '#38383A' : '#C6C6C8' }]}>
                <Ionicons name="at-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.labelText }]}>{t('profile.edit.nickname')}</Text>
                  <Text style={[styles.infoValue, { color: colors.bodyText }]} numberOfLines={2}>
                    {profile.nickname}
                  </Text>
                </View>
              </View>
            )}
            {profile.displayName?.trim() && (
              <View style={[styles.infoRow, { borderBottomColor: isDark ? '#38383A' : '#C6C6C8' }]}>
                <Ionicons name="person-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.labelText }]}>{t('profile.edit.displayName')}</Text>
                  <Text style={[styles.infoValue, { color: colors.bodyText }]} numberOfLines={2}>
                    {profile.displayName}
                  </Text>
                </View>
              </View>
            )}
            {profile.bio?.trim() && (
              <View style={[styles.infoRow, { borderBottomColor: isDark ? '#38383A' : '#C6C6C8' }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.labelText }]}>{t('profile.edit.bio')}</Text>
                  <Text style={[styles.infoValue, { color: colors.bodyText }]} numberOfLines={4}>
                    {profile.bio}
                  </Text>
                </View>
              </View>
            )}
            <InfoRow
              icon="call-outline"
              label={t('profile.edit.phoneNumber')}
              value={profile?.phoneNumber}
              colors={colors}
              isDark={isDark}
              onPress={profile?.phoneNumber ? () => Linking.openURL(`tel:${profile.phoneNumber}`) : undefined}
            />
            <InfoRow
              icon="location-outline"
              label={t('profile.edit.location')}
              value={profile?.location}
              colors={colors}
              isDark={isDark}
            />
            <InfoRow
              icon="globe-outline"
              label={t('profile.edit.websiteURL')}
              value={profile?.websiteURL}
              colors={colors}
              isDark={isDark}
              onPress={profile?.websiteURL ? () => Linking.openURL(profile.websiteURL) : undefined}
            />
          </ProfileElevated>
        </>
      )}

      <Text style={[styles.sectionHeader, { color: sectionHeaderColor }]}>
        {t('profile.addresses.sectionTitle').toUpperCase()}
      </Text>
      <ProfileElevated isDark={isDark} rowBg={rowBg}>
        <Pressable
          onPress={() => {
            setEditingAddress(null);
            setAddressSheetOpen(true);
          }}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="add-circle-outline" size={24} color={colors.tint} />
            <Text style={[styles.rowTitle, { color: colors.tint }]}>
              {t('profile.addresses.add')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
        </Pressable>
        {addresses.length === 0 ? (
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: isDark ? '#38383A' : '#C6C6C8' }]}>
            <Text style={[styles.infoLabel, { color: colors.labelText }]}>
              {t('profile.addresses.empty')}
            </Text>
          </View>
        ) : (
          addresses.map((addr) => {
            const summary = [addr.addressLine1, addr.city, addr.country].filter((s) => s?.trim()).join(' · ');
            return (
              <Pressable
                key={addr.id}
                onPress={() => {
                  setEditingAddress(addr);
                  setAddressSheetOpen(true);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderTopWidth: 1,
                    borderTopColor: isDark ? '#38383A' : '#C6C6C8',
                    opacity: pressed ? 0.6 : 1,
                    alignItems: 'flex-start',
                  },
                ]}
              >
                <Ionicons name="location-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {addr.title?.trim() || t('profile.addresses.line1')}
                    </Text>
                    {addr.isDefault && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.tint }}>
                          {t('profile.addresses.defaultBadge')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!!summary && (
                    <Text
                      style={[styles.infoLabel, { color: colors.labelText, marginTop: 4 }]}
                      numberOfLines={2}
                    >
                      {summary}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
              </Pressable>
            );
          })
        )}
      </ProfileElevated>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.errorColor || '#FF3B30' }]}>
            {error}
          </Text>
          <Pressable onPress={onFetchProfile} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: colors.tint }]}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      )}

      <Text
        style={[
          styles.sectionHeader,
          { color: sectionHeaderColor },
        ]}
      >
        {t('profile.organizations.title').toUpperCase()}
      </Text>
      <ProfileElevated isDark={isDark} rowBg={rowBg}>
        <Pressable
          onPress={onOpenCreateOrgSheet}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="add-circle-outline" size={24} color={colors.tint} />
            <Text style={[styles.rowTitle, { color: colors.tint }]}>
              {t('profile.organizations.createButton')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
        </Pressable>
        {organizations.length === 0 ? (
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: isDark ? '#38383A' : '#C6C6C8' }]}>
            <Text style={[styles.infoLabel, { color: colors.labelText }]}>
              {t('profile.organizations.empty')}
            </Text>
          </View>
        ) : (
          organizations.map((org) => (
            <Pressable
              key={org.id}
              onPress={() => onOrganizationPress(org)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderTopWidth: 1,
                  borderTopColor: isDark ? '#38383A' : '#C6C6C8',
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="business-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
              <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>
                {org.name}
              </Text>
              <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} />
            </Pressable>
          ))
        )}
      </ProfileElevated>

      {organizations.length > 0 ? (
        <>
          <Text
            style={[
              styles.sectionHeader,
              { color: sectionHeaderColor },
            ]}
          >
            {t('profile.organizations.sharedProjectsTitle').toUpperCase()}
          </Text>
          <ProfileElevated isDark={isDark} rowBg={rowBg}>
            {sharedProjectsLoading ? (
              <View style={[styles.row, { justifyContent: 'center', paddingVertical: 20 }]}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            ) : sharedProjects.length === 0 ? (
              <View style={[styles.row, { alignItems: 'flex-start' }]}>
                <Ionicons name="git-network-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
                <Text style={[styles.infoLabel, { color: colors.labelText, flex: 1 }]}>
                  {t('profile.organizations.sharedProjectsEmpty')}
                </Text>
              </View>
            ) : (
              sharedProjects.map((row, i) => {
                const hostLabel =
                  row.hostOrganizationName?.trim() ||
                  t('profile.organizations.sharedProjectsHostUnknown');
                return (
                  <Pressable
                    key={`${row.contextOrganizationId}-${row.project.id}`}
                    onPress={() => onSharedProjectPress(row.contextOrganizationId, row.project.id)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: isDark ? '#38383A' : '#C6C6C8',
                        opacity: pressed ? 0.6 : 1,
                        alignItems: 'flex-start',
                      },
                    ]}
                  >
                    <Ionicons name="folder-outline" size={20} color={colors.tint} style={styles.infoIcon} />
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                        {row.project.name}
                      </Text>
                      <Text
                        style={[styles.infoLabel, { color: colors.labelText, marginTop: 4, fontSize: 13 }]}
                        numberOfLines={2}
                      >
                        {t('profile.organizations.sharedProjectsViaOrg', {
                          org: row.contextOrganizationName,
                        })}
                      </Text>
                      <Text
                        style={[styles.infoLabel, { color: colors.labelText, marginTop: 2, fontSize: 12 }]}
                        numberOfLines={1}
                      >
                        {t('profile.organizations.sharedProjectsHostLabel', { host: hostLabel })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} style={{ marginTop: 2 }} />
                  </Pressable>
                );
              })
            )}
          </ProfileElevated>
        </>
      ) : null}

      <Text
        style={[
          styles.sectionHeader,
          { color: sectionHeaderColor },
        ]}
      >
        {(t('profile.sections.account') || 'Account').toUpperCase()}
      </Text>
      <ProfileElevated isDark={isDark} rowBg={rowBg}>
        <Pressable
          onPress={() => setEmailSheetOpen(true)}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.6 : 1, alignItems: 'flex-start' },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.account.emailA11y')}
        >
          <Ionicons name="mail-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {t('profile.account.emailRowTitle')}
            </Text>
            <Text
              style={[styles.infoLabel, { color: colors.labelText, marginTop: 4, fontWeight: '400', fontSize: 13 }]}
              numberOfLines={2}
            >
              {email}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} style={{ marginTop: 2 }} />
        </Pressable>
        {email.trim().length > 0 ? (
          <Pressable
            onPress={onResetPasswordPress}
            style={({ pressed }) => [
              styles.row,
              {
                opacity: pressed ? 0.6 : 1,
                borderTopWidth: 1,
                borderTopColor: isDark ? '#38383A' : '#C6C6C8',
                alignItems: 'flex-start',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('profile.account.resetPasswordA11y')}
          >
            <Ionicons name="key-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {t('profile.account.resetPasswordRowTitle')}
              </Text>
              <Text
                style={[styles.infoLabel, { color: colors.labelText, marginTop: 4, fontSize: 13, fontWeight: '400' }]}
                numberOfLines={2}
              >
                {t('profile.account.resetPasswordRowSubtitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} style={{ marginTop: 2 }} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSettingsPress}
          style={({ pressed }) => [
            styles.row,
            {
              opacity: pressed ? 0.6 : 1,
              borderTopWidth: 1,
              borderTopColor: isDark ? '#38383A' : '#C6C6C8',
              alignItems: 'flex-start',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.account.settingsA11y')}
        >
          <Ionicons name="settings-outline" size={20} color={colors.labelText} style={styles.infoIcon} />
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {t('settings.title')}
            </Text>
            <Text
              style={[styles.infoLabel, { color: colors.labelText, marginTop: 4, fontSize: 13, fontWeight: '400' }]}
              numberOfLines={2}
            >
              {t('profile.account.settingsRowSubtitle')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={Sizing.icon.s} color={colors.icon} style={{ marginTop: 2 }} />
        </Pressable>
      </ProfileElevated>

      <Text
        style={[
          styles.sectionHeader,
          { color: sectionHeaderColor },
        ]}
      >
        {t('profile.deleteAccount.sectionTitle').toUpperCase()}
      </Text>
      <Text style={[styles.sectionDescription, { color: sectionHeaderColor }]}>
        {t('profile.deleteAccount.sectionSummary')}
      </Text>
      <ProfileElevated isDark={isDark} rowBg={rowBg}>
        <View
          style={{
            padding: Sizing.padding.m,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#38383A' : '#C6C6C8',
          }}
        >
          {deletionImpactLoading ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: Sizing.padding.m,
                gap: 12,
              }}
            >
              <ActivityIndicator size="small" color={colors.tint} />
              <Text style={[styles.infoLabel, { color: colors.labelText, fontSize: 14, fontWeight: '400' }]}>
                {t('profile.deleteAccount.loadingImpact')}
              </Text>
            </View>
          ) : deletionImpact ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: (colors.errorColor ?? '#FF3B30') + (isDark ? '33' : '22'),
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Ionicons name="trash-outline" size={22} color={colors.errorColor ?? '#FF3B30'} />
                </View>
                <Text
                  style={[styles.rowTitle, { flex: 1, color: colors.bodyText, fontSize: 16 }]}
                  numberOfLines={2}
                >
                  {t('profile.deleteAccount.impactCardTitle')}
                </Text>
              </View>
              <DeleteAccountImpactBadgeStrip impact={deletionImpact} colors={colors} isDark={isDark} />
              <Pressable
                onPress={() => setDeleteImpactExpanded((v) => !v)}
                style={({ pressed }) => ({
                  marginTop: 12,
                  paddingVertical: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={
                  deleteImpactExpanded
                    ? t('profile.deleteAccount.badges.collapseA11y')
                    : t('profile.deleteAccount.badges.expandA11y')
                }
              >
                <Text style={{ color: colors.tint, fontSize: 15, fontWeight: '600' }}>
                  {deleteImpactExpanded
                    ? t('profile.deleteAccount.badges.collapseDetails')
                    : t('profile.deleteAccount.badges.expandDetails')}
                </Text>
              </Pressable>
              {deleteImpactExpanded ? (
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={[
                      styles.infoLabel,
                      {
                        color: colors.labelText,
                        lineHeight: 20,
                        fontSize: 13,
                        fontWeight: '400',
                        marginBottom: 10,
                      },
                    ]}
                  >
                    {t('profile.deleteAccount.sectionDescription')}
                  </Text>
                  <DeleteAccountImpactList
                    impact={deletionImpact}
                    compact
                    colors={colors}
                    isDark={isDark}
                    omitFooterCallout
                  />
                </View>
              ) : null}
            </>
          ) : (
            <View style={{ paddingVertical: Sizing.padding.s }}>
              <Text style={[styles.infoLabel, { color: colors.labelText, lineHeight: 20, fontSize: 14, fontWeight: '400' }]}>
                {t('profile.deleteAccount.fallbackDetail')}
              </Text>
            </View>
          )}
        </View>
        <View style={{ padding: Sizing.padding.m }}>
          <Pressable
            onPress={() => {
              void onRefreshDeletionImpact();
              setDeleteAccountSheetOpen(true);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: Sizing.padding.m,
              paddingHorizontal: Sizing.padding.xl,
              borderRadius: 12,
              backgroundColor: colors.errorColor ?? '#FF3B30',
              opacity: pressed ? 0.88 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={t('profile.deleteAccount.button')}
          >
            <Ionicons name="warning-outline" size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#FFFFFF' }}>
              {t('profile.deleteAccount.button')}
            </Text>
          </Pressable>
        </View>
      </ProfileElevated>

      <ConfirmationBottomSheet
        visible={deleteAccountSheetOpen}
        title={t('profile.deleteAccount.confirmTitle')}
        message={t('profile.deleteAccount.confirmSheetMinimal')}
        cancelLabel={t('profile.deleteAccount.cancel')}
        confirmLabel={t('profile.deleteAccount.confirm')}
        destructive
        loading={deleteAccountLoading}
        onCancel={() => !deleteAccountLoading && setDeleteAccountSheetOpen(false)}
        onConfirm={async () => {
          setDeleteAccountLoading(true);
          try {
            const err = await onDeleteAccount();
            if (err) {
              setDeleteAccountErrorMessage(err);
            } else {
              setDeleteAccountSheetOpen(false);
            }
          } finally {
            setDeleteAccountLoading(false);
          }
        }}
      />

      <EditProfileSheet
        visible={showEditSheet}
        profile={profile}
        onClose={onCloseEditSheet}
        onSave={onUpdateProfile}
      />
      <EditEmailSheet
        visible={emailSheetOpen}
        currentEmail={email}
        onClose={() => setEmailSheetOpen(false)}
        onSave={onUpdateSignInEmail}
      />
      <CreateOrganizationSheet
        visible={showCreateOrgSheet}
        onClose={onCloseCreateOrgSheet}
        onCreate={onCreateOrganization}
      />
      <SetUsernameSheet
        visible={showSetUsernameSheet}
        onComplete={onSetNicknameComplete}
      />
      <ManageAddressSheet
        visible={addressSheetOpen}
        address={editingAddress}
        onClose={() => {
          setAddressSheetOpen(false);
          setEditingAddress(null);
        }}
        onSave={onSaveAddress}
        onDelete={onDeleteAddress}
      />

      {deleteAccountErrorMessage ? (
        <MessageBottomSheet
          visible
          onDismiss={() => setDeleteAccountErrorMessage(null)}
          title={t('profile.deleteAccount.errorTitle')}
          message={deleteAccountErrorMessage}
          variant="error"
          primaryAction={okSheetAction(() => setDeleteAccountErrorMessage(null))}
        />
      ) : null}
    </ScrollView>
  );
}
