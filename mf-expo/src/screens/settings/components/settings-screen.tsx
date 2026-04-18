import React from 'react';

import { AppBarScaffold } from '@/src/shared/components/AppBarScaffold';
import { ScreenHeader } from '@/src/shared/components/ScreenHeader';
import { t } from '@/src/shared/i18n';
import { useMasterView, useThemeColors } from 'masterfabric-expo-core';
import { useSettingsViewModel } from '../hooks/use-settings-view-model';
import { settingsStyles } from '../styles/settings-styles';
import { SettingsContent } from './settings-content';

interface SettingsScreenProps {
  /** When false, hides the back button (e.g. when shown as tab) */
  showBackButton?: boolean;
}

// Hook-based MasterView implementation for Settings Screen
function SettingsScreenContent({ showBackButton = true }: SettingsScreenProps) {
  const colors = useThemeColors();
  const { trackActivity } = useMasterView();
  
  const { 
    currentLanguage, 
    handleLanguageChange, 
    selectedTheme, 
    handleThemeChange, 
    navigateBack 
  } = useSettingsViewModel();

  // Track activity when component mounts
  React.useEffect(() => {
    trackActivity('settings_initialized');
    
    return () => {
      trackActivity('settings_destroyed');
    };
  }, [trackActivity]);

  return (
    <AppBarScaffold
      style={settingsStyles.container}
      backgroundColor={colors.settingsBackground}
      appBar={
        <ScreenHeader
          title={t('settings.title')}
          subtitle={t('settings.subtitle') || t('settings.description')}
          onBackPress={navigateBack}
          showBackButton={showBackButton}
          variant="minimal"
        />
      }
    >
      <SettingsContent
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        selectedTheme={selectedTheme}
        onThemeChange={handleThemeChange}
      />
    </AppBarScaffold>
  );
}

export function SettingsScreen({ showBackButton = true }: SettingsScreenProps = {}) {
  return <SettingsScreenContent showBackButton={showBackButton} />;
}