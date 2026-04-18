import { ThemedText } from '@/src/shared/components/ThemedText';
import { ThemedSurface } from '@/src/shared/components/ui/ThemedSurface';
import { useAppStore } from '@/src/shared/store';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { backendSectionStyles } from '../../styles/backend-section.styles';
import { BackendAction } from '../../utils';

interface MfGoSectionProps {
  mfGoActions: BackendAction[];
  onActionPress: (actionId: string, actionTitle: string) => void;
}

const mfGoBlue = '#2563eb';

export function MfGoSection({ mfGoActions, onActionPress }: MfGoSectionProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const { user, isAuthenticated } = useAppStore();

  return (
    <View style={backendSectionStyles.section}>
      <View style={backendSectionStyles.header}>
        <View style={backendSectionStyles.logoTitleRow}>
          <View style={[backendSectionStyles.logo, { width: 32, height: 32, backgroundColor: mfGoBlue + '30', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="server" size={18} color={mfGoBlue} />
          </View>
          <View style={backendSectionStyles.titleRow}>
            <ThemedText type="subtitle" style={[backendSectionStyles.sectionTitle, { color: colors.sectionTitle }]}>
              mf-go Backend
            </ThemedText>
            <View style={[backendSectionStyles.statusDotContainer, { marginLeft: 8 }]}>
              <View style={[backendSectionStyles.statusDot, { backgroundColor: isAuthenticated ? mfGoBlue : '#94a3b8' }]} />
            </View>
          </View>
        </View>
        <View style={backendSectionStyles.headerText}>
          <ThemedText style={[backendSectionStyles.sectionDescription, { color: colors.actionDescription }]}>
            GraphQL API (Auth, User, Settings)
          </ThemedText>
          {isAuthenticated && user && (
            <View style={[backendSectionStyles.signedInCard, { backgroundColor: mfGoBlue + '15', borderColor: mfGoBlue + '30' }]}>
              <View style={backendSectionStyles.signedInRow}>
                <Ionicons name="checkmark-circle" size={16} color={mfGoBlue} />
                <ThemedText style={[backendSectionStyles.signedInText, { color: colors.bodyText }]}>
                  Signed in as: {user.email || user.name}
                </ThemedText>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={backendSectionStyles.actionsList}>
        {mfGoActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={() => onActionPress(action.id, action.title)}
            activeOpacity={0.8}
          >
            <ThemedSurface
              variant="surface"
              style={[
                backendSectionStyles.actionCard,
                {
                  borderColor: mfGoBlue + '30',
                  borderWidth: 1.5,
                  borderRadius: 12,
                  overflow: 'hidden',
                },
              ]}
            >
              <View style={[backendSectionStyles.actionIcon, { backgroundColor: mfGoBlue + '15', borderColor: mfGoBlue + '25' }]}>
                {action.iconType === 'icon' && action.iconName && (
                  <Ionicons name={action.iconName as any} size={24} color={mfGoBlue} />
                )}
              </View>
              <View style={backendSectionStyles.actionContent}>
                <ThemedText type="defaultSemiBold" style={[backendSectionStyles.actionTitle, { color: colors.bodyText, fontSize: 17 }]}>
                  {action.title}
                </ThemedText>
                <ThemedText style={[backendSectionStyles.actionDescription, { color: colors.actionDescription, fontSize: 15 }]}>
                  {action.description}
                </ThemedText>
              </View>
            </ThemedSurface>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
