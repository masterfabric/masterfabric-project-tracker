import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { StepControlsProps } from '../store/onboarding-store';
import { stepControlsStyles } from '../styles/step-controls.styles';

export function StepControls({
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  controlsDisabled = false,
  a11yProgressLabel,
}: StepControlsProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const tint = colors.tint;
  const outlineBorder = isDark
    ? 'rgba(255,255,255,0.2)'
    : 'rgba(0,0,0,0.14)';

  const nextHint = isLastStep
    ? t('onboarding.a11y.getStartedHint')
    : t('onboarding.a11y.nextHint');

  const onPrimaryPress = () => {
    if (controlsDisabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext();
  };

  const onGhostPress = () => {
    if (controlsDisabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  const backLabel = t('onboarding.back');

  return (
    <View style={stepControlsStyles.container}>
      <View style={stepControlsStyles.bar}>
        <View style={stepControlsStyles.leadingWrap}>
          {!isFirstStep ? (
            <Pressable
              onPress={onGhostPress}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              accessibilityHint={t('onboarding.a11y.backHint')}
              accessibilityState={{ disabled: controlsDisabled }}
              disabled={controlsDisabled}
              hitSlop={8}
              style={({ pressed }) => [
                stepControlsStyles.backTextPressable,
                {
                  opacity: controlsDisabled ? 0.35 : pressed ? 0.55 : 1,
                },
              ]}
            >
              <ThemedText
                style={[
                  stepControlsStyles.backTextLabel,
                  { color: colors.labelText },
                ]}
                numberOfLines={1}
              >
                {backLabel}
              </ThemedText>
            </Pressable>
          ) : (
            <View
              style={stepControlsStyles.backTextPressable}
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <ThemedText
                style={[
                  stepControlsStyles.backTextLabel,
                  { color: colors.labelText, opacity: 0 },
                ]}
                numberOfLines={1}
              >
                {backLabel}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={stepControlsStyles.trailingWrap}>
          <Pressable
            onPress={onPrimaryPress}
            accessibilityRole="button"
            accessibilityLabel={
              isLastStep ? t('onboarding.getStarted') : t('onboarding.next')
            }
            accessibilityHint={`${nextHint} ${a11yProgressLabel}`}
            accessibilityState={{ disabled: controlsDisabled }}
            disabled={controlsDisabled}
            style={({ pressed }) => [
              stepControlsStyles.nextChip,
              isLastStep
                ? {
                    backgroundColor: tint,
                    borderColor: tint,
                    opacity: controlsDisabled ? 0.38 : pressed ? 0.88 : 1,
                  }
                : {
                    backgroundColor: 'transparent',
                    borderColor: outlineBorder,
                    opacity: controlsDisabled ? 0.38 : pressed ? 0.78 : 1,
                  },
            ]}
          >
            <ThemedText
              style={[
                stepControlsStyles.nextChipLabel,
                {
                  color: isLastStep
                    ? colors.activeButtonText
                    : tint,
                },
              ]}
              numberOfLines={1}
            >
              {isLastStep ? t('onboarding.getStarted') : t('onboarding.next')}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
