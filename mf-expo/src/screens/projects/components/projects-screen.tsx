import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { MessageBottomSheet, okSheetAction } from '@/src/shared/components/MessageBottomSheet';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { t } from '@/src/shared/i18n';
import { Sizing, getThemeColors, typographyHelper, useTheme } from 'masterfabric-expo-core';
import { useProjectsViewModel } from '../hooks/use-projects-view-model';
import { GitHubProject } from '../models/project-models';
import { projectsScreenStyles } from '../styles/projects-screen.styles';
import { ProjectCard } from './project-card';

export function ProjectsScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);

  const {
    projects,
    isLoading,
    error,
    handleProjectPress,
    handleRefresh,
    linkOpenErrorVisible,
    dismissLinkOpenError,
  } = useProjectsViewModel();

  const renderProject = ({ item }: { item: GitHubProject }) => (
    <ProjectCard
      project={item}
      onPress={handleProjectPress}
    />
  );

  const renderEmpty = () => (
    <View style={{ alignItems: Sizing.layout.alignItems.center, paddingTop: Sizing.padding.xxxl }}>
      <Ionicons 
        name="folder-open-outline" 
        size={Sizing.icon.xxxl + Sizing.icon.xl} 
        color={colors.icon + '60'} 
      />
      <Text style={[{ 
        color: colors.icon, 
        marginTop: Sizing.padding.l,
        textAlign: Sizing.layout.textAlign.center,
      }, typographyHelper.fromSizing.createStyle(Sizing, 'l', 'semibold', 'normal')]}>
        {error ? t('projects.loadError') : t('projects.noProjects')}
      </Text>
      {error && (
        <Text style={[{ 
          color: colors.icon, 
          marginTop: Sizing.gap.s,
          textAlign: Sizing.layout.textAlign.center,
          paddingHorizontal: Sizing.padding.xxl,
        }, typographyHelper.fromSizing.createStyle(Sizing, 's', 'normal', 'normal')]}>
          {t('projects.refreshHint')}
        </Text>
      )}
    </View>
  );

  return (
    <>
    <AppBarScaffold
      style={projectsScreenStyles.container}
      backgroundColor={colors.background}
      appBar={
        <>
          <ScreenHeader
            title={t('projects.title')}
            subtitle={t('projects.subtitle')}
            variant="minimal"
          />
        </>
      }
    >
        <FlatList
          data={projects}
          renderItem={renderProject}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              colors={[colors.tint]}
              tintColor={colors.tint}
            />
          }
          ListEmptyComponent={!isLoading ? renderEmpty : null}
          contentContainerStyle={{
            paddingTop: Sizing.padding.s,
            paddingBottom: Sizing.padding.xxl,
            flexGrow: Sizing.flexNumber.full,
            backgroundColor: 'transparent',
          }}
          style={{
            flex: Sizing.flexNumber.full,
            paddingHorizontal: Sizing.padding.m,
            backgroundColor: 'transparent',
          }}
        />
    </AppBarScaffold>
    <MessageBottomSheet
      visible={linkOpenErrorVisible}
      onDismiss={dismissLinkOpenError}
      title={t('common.error')}
      message={t('projects.openLinkError')}
      variant="error"
      primaryAction={okSheetAction(dismissLinkOpenError)}
    />
    </>
  );
}
