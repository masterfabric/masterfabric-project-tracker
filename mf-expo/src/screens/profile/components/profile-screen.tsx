import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { useAppStore } from '@/src/shared/store';
import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useMasterView, useThemeColors } from 'masterfabric-expo-core';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useProfileViewModel } from '../hooks/use-profile-view-model';
import { profileStyles } from '../styles/profile-styles';
import { ProfileContent } from './profile-content';

export function ProfileScreen() {
  const colors = useThemeColors();
  const { trackActivity } = useMasterView();
  const [showEditSheet, setShowEditSheet] = useState(false);
  const {
    profile,
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
    addresses,
    saveAddress,
    deleteAddress,
    updateProfile,
    updateSignInEmail,
    createOrganization,
    acceptInvitation,
    declineInvitation,
    navigateBack,
    navigateToSettings,
    navigateToArchivedItems,
    navigateToResetPassword,
    navigateToOrganization,
    navigateToSharedProject,
    deleteAccount,
    deletionImpact,
    deletionImpactLoading,
    fetchDeletionImpact,
  } = useProfileViewModel();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    trackActivity('profile_initialized');
    return () => trackActivity('profile_destroyed');
  }, [trackActivity]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppBarScaffold
      style={profileStyles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={t('profile.title')}
          subtitle={t('profile.subtitle')}
          onBackPress={navigateBack}
          showBackButton={true}
          variant="minimal"
          rightAction={
            <Pressable
              onPress={() => setShowEditSheet(true)}
              style={({ pressed }) => [
                { padding: 8, marginRight: -8, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.editButton')}
            >
              <Ionicons name="pencil" size={22} color={colors.tint} />
            </Pressable>
          }
        />
      }
    >
        <ProfileContent
          profile={profile}
          organizations={organizations}
          sharedProjects={sharedProjects}
          sharedProjectsLoading={sharedProjectsLoading}
          invitations={invitations}
          isLoading={isLoading}
          error={error}
          showEditSheet={showEditSheet}
          showCreateOrgSheet={showCreateOrgSheet}
          onCloseEditSheet={() => setShowEditSheet(false)}
          onOpenCreateOrgSheet={() => setShowCreateOrgSheet(true)}
          onCloseCreateOrgSheet={() => setShowCreateOrgSheet(false)}
          onFetchProfile={fetchProfile}
          onUpdateProfile={updateProfile}
          onUpdateSignInEmail={updateSignInEmail}
          onCreateOrganization={createOrganization}
          onAcceptInvitation={acceptInvitation}
          onDeclineInvitation={declineInvitation}
          onSettingsPress={navigateToSettings}
          onArchivedItemsPress={navigateToArchivedItems}
          onResetPasswordPress={navigateToResetPassword}
          onOrganizationPress={navigateToOrganization}
          onSharedProjectPress={navigateToSharedProject}
          showSetUsernameSheet={showSetUsernameSheet}
          onSetNicknameComplete={setNicknameComplete}
          addresses={addresses}
          onSaveAddress={saveAddress}
          onDeleteAddress={deleteAddress}
          onDeleteAccount={deleteAccount}
          deletionImpact={deletionImpact}
          deletionImpactLoading={deletionImpactLoading}
          onRefreshDeletionImpact={fetchDeletionImpact}
        />
    </AppBarScaffold>
  );
}
