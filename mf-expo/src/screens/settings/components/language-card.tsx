import { Dropdown } from '@/src/shared/components/Dropdown';
import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { View } from 'react-native';
import { LanguageCardProps } from '../models/settings-models';
import { cardStyles } from '../styles/card-styles';
import { languageStyles } from '../styles/language-styles';
import { getLanguageOptions } from '../utils';
import { settingsStyles } from '../styles/settings-styles';

export function LanguageCard({
  currentLanguage,
  onLanguageChange,
  variant = 'card',
  rowBg,
}: LanguageCardProps) {
  const { colors } = useTheme();

  const languageOptions = getLanguageOptions();

  if (variant === 'row') {
    return (
      <View style={[settingsStyles.row, { backgroundColor: rowBg }]}>
        <Dropdown
          options={languageOptions}
          selectedValue={currentLanguage.split('-')[0]}
          onSelect={onLanguageChange}
          placeholder={t('settings.language')}
          style={[
            languageStyles.dropdown,
            {
              backgroundColor: 'transparent',
              borderWidth: 0,
              padding: 0,
              minHeight: 0,
              flex: 1,
            },
          ]}
        />
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
          <Ionicons name="language" size={22} color="#34C759" />
        </View>
        <View style={cardStyles.cardHeaderContent}>
          <ThemedText style={[cardStyles.cardTitle, { color: colors.text }]}>
            {t('settings.languageCard.title')}
          </ThemedText>
          <ThemedText
            style={[cardStyles.cardSubtitle, { color: colors.settingsDescription }]}
          >
            {t('settings.languageCard.subtitle')}
          </ThemedText>
        </View>
      </View>

      <View style={cardStyles.cardBody}>
        <Dropdown
          options={languageOptions}
          selectedValue={currentLanguage.split('-')[0]}
          onSelect={onLanguageChange}
          placeholder={t('settings.language')}
          style={[
            languageStyles.dropdown,
            {
              backgroundColor: colors.settingsThemeOptionBg,
              borderColor: colors.settingsDropdownBorder,
            },
          ]}
        />
      </View>
    </View>
  );
}
