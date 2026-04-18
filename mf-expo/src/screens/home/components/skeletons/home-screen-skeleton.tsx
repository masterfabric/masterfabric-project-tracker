import { useAppStore } from '@/src/shared/store';
import { useThemeColors } from 'masterfabric-expo-core';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeScreenStyles } from '../../styles/home-screen.styles';
import { HomeHeaderSkeleton } from './home-header-skeleton';
import { OrganizationNewsSectionSkeleton } from './organization-news-section-skeleton';
import { TodosSectionSkeleton } from './todos-section-skeleton';
import { WelcomeSectionSkeleton } from './welcome-section-skeleton';

export function HomeScreenSkeleton() {
  const colors = useThemeColors();
  const isMfGoAuthenticated = useAppStore((s) => !!(s.authToken && s.mfGoSession));

  return (
    <SafeAreaView
      style={[homeScreenStyles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={{ flex: 1 }}>
        <HomeHeaderSkeleton />
        <ScrollView
          style={homeScreenStyles.content}
          contentContainerStyle={[homeScreenStyles.scrollContent, { paddingTop: 12 }]}
          showsVerticalScrollIndicator={false}
        >
          <WelcomeSectionSkeleton />
          <TodosSectionSkeleton />
          {isMfGoAuthenticated ? <OrganizationNewsSectionSkeleton /> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
