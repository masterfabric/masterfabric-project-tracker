import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppearanceCardProps } from '../models/settings-models';
import { appearanceStyles } from '../styles/appearance-styles';
import { cardStyles } from '../styles/card-styles';
import { getThemeOptions, getThemePreviewColors } from '../utils';
import { settingsStyles } from '../styles/settings-styles';

export function AppearanceCard({
  selectedTheme,
  onThemeChange,
  variant = 'card',
  rowBg,
}: AppearanceCardProps) {
  const { isDark, colors } = useTheme();

  const themeOptions = getThemeOptions(t);

  if (variant === 'row') {
    return (
      <View style={{ backgroundColor: rowBg }}>
        {themeOptions.map((theme, index) => {
          const isSelected = selectedTheme === theme.key;
          const isLast = index === themeOptions.length - 1;
          return (
            <TouchableOpacity
              key={theme.key}
              style={[
                settingsStyles.row,
                !isLast && [
                  settingsStyles.rowWithSeparator,
                  { borderBottomColor: colors.divider },
                ],
                { backgroundColor: rowBg },
              ]}
              onPress={() => onThemeChange(theme.key as any)}
              activeOpacity={0.6}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${t('settings.switchTo')} ${theme.label}`}
            >
              <ThemedText
                style={[
                  settingsStyles.rowTitle,
                  {
                    color: isSelected ? colors.activeButton : colors.text,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {theme.label}
              </ThemedText>
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={22}
                  color={colors.activeButton}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: colors.settingsCardBackground,
          borderColor: colors.settingsCardBorder,
          borderWidth: 1,
        },
      ]}
    >
      <View style={cardStyles.cardHeader}>
        <View
          style={[
            cardStyles.iconContainer,
            { backgroundColor: colors.settingsIconBackground },
          ]}
        >
          <Ionicons name="color-palette" size={22} color="#FF9500" />
        </View>
        <View style={cardStyles.cardHeaderContent}>
          <ThemedText style={[cardStyles.cardTitle, { color: colors.text }]}>
            {t('settings.appearanceCard.title')}
          </ThemedText>
          <ThemedText
            style={[cardStyles.cardSubtitle, { color: colors.settingsDescription }]}
          >
            {t('settings.appearanceCard.subtitle')}
          </ThemedText>
        </View>
      </View>

      <View style={cardStyles.cardBody}>
        <View style={appearanceStyles.themeGrid}>
          {themeOptions.map((theme) => {
            const isSelected = selectedTheme === theme.key;
            const previewColors = getThemePreviewColors(theme.key);

            return (
              <TouchableOpacity
                key={theme.key}
                style={[
                  appearanceStyles.modernThemeCard,
                  {
                    backgroundColor: isSelected
                      ? colors.activeButton + '10'
                      : colors.settingsThemeOptionBg,
                    borderColor: isSelected
                      ? colors.activeButton
                      : colors.settingsThemeOptionBorder,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => onThemeChange(theme.key as any)}
                accessibilityRole="button"
                accessibilityLabel={`${t('settings.switchTo')} ${theme.label}`}
              >
                <View
                  style={[
                    appearanceStyles.themePreview,
                    {
                      backgroundColor: previewColors.background,
                      borderColor: colors.settingsThemeOptionBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      appearanceStyles.previewElement,
                      { backgroundColor: previewColors.element1 },
                    ]}
                  />
                  <View
                    style={[
                      appearanceStyles.previewElement,
                      {
                        backgroundColor: previewColors.element2,
                        width: '60%',
                      },
                    ]}
                  />
                </View>

                <View style={appearanceStyles.themeInfo}>
                  <View style={appearanceStyles.themeHeader}>
                    <Ionicons
                      name={theme.icon as any}
                      size={16}
                      color={
                        isSelected ? colors.activeButton : colors.settingsDescription
                      }
                    />
                    <ThemedText
                      style={[
                        appearanceStyles.modernThemeLabel,
                        {
                          color: isSelected ? colors.activeButton : colors.text,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {theme.label}
                    </ThemedText>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.activeButton}
                      />
                    )}
                  </View>

                  <ThemedText
                    style={[
                      appearanceStyles.modernThemeDescription,
                      { color: colors.settingsDescription },
                    ]}
                  >
                    {theme.desc}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
