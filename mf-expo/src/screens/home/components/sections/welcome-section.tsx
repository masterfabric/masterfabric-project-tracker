import { ThemedText } from '@/src/shared/components/ThemedText';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import {
  SOFT_CARD_RADIUS,
  cardShadowStyle,
} from '@/src/shared/ui/screen-card-styles';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { OrganizationPayload, UserProfile } from '@/src/shared/services/mf-go-api';
import { User } from '../../models/home-models';
import { welcomeSectionStyles } from '../../styles/welcome-section.styles';

interface WelcomeSectionProps {
  user: User | null;
  profile: UserProfile | null;
  organizations?: OrganizationPayload[];
}

export const WelcomeSection = React.memo(function WelcomeSection({
  user,
  profile,
  organizations = [],
}: WelcomeSectionProps) {
  useLocale();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const displayName = user?.name ?? profile?.displayName ?? '';
  const nickname = profile?.nickname?.trim();
  const bio = profile?.bio?.trim();

  const greetingName = displayName || t('profile.unknownName');
  const cardStyle = useMemo(
    () => [
      welcomeSectionStyles.card,
      {
        borderRadius: SOFT_CARD_RADIUS,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.surfaceBorder,
        // Dark: elevated card (#1C1C1E) vs page (#000) improves contrast for secondary text
        backgroundColor: isDark ? colors.surfaceBackground : colors.settingsBackground,
      },
    ],
    [colors.settingsBackground, colors.surfaceBackground, colors.surfaceBorder, isDark]
  );
  const outerStyle = useMemo(
    () => [welcomeSectionStyles.outer, { borderRadius: SOFT_CARD_RADIUS }, cardShadowStyle(isDark)],
    [isDark]
  );

  return (
    <View style={outerStyle}>
      <View style={cardStyle}>
        <View style={welcomeSectionStyles.cardInner}>
          <ThemedText style={[welcomeSectionStyles.greeting, { color: colors.text }]}>
            {t('home.greeting', { name: greetingName })}
          </ThemedText>
          {nickname ? (
            <ThemedText
              style={[
                welcomeSectionStyles.userNickname,
                { color: colors.labelText, opacity: isDark ? 1 : 0.9 },
              ]}
            >
              @{nickname}
            </ThemedText>
          ) : null}
          {organizations.length > 0 ? (
            <ThemedText style={[welcomeSectionStyles.orgLine, { color: colors.tint }]} numberOfLines={1}>
              {organizations.length === 1
                ? t('home.greetingOrganization', { name: organizations[0].name })
                : t('home.greetingOrganizationsMore', {
                    name: organizations[0].name,
                    count: organizations.length - 1,
                  })}
            </ThemedText>
          ) : null}
          {bio ? (
            <ThemedText
              style={[welcomeSectionStyles.bio, { color: colors.labelText }]}
              numberOfLines={3}
            >
              {bio}
            </ThemedText>
          ) : (
            <ThemedText
              style={[
                welcomeSectionStyles.hint,
                { color: colors.labelText, opacity: isDark ? 1 : 0.85 },
              ]}
            >
              {t('home.todos.description')}
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
});
