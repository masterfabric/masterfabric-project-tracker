import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/src/shared/components/ThemedText';
import { t } from '@/src/shared/i18n';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { useOnboardingViewModel } from '../hooks/use-onboarding-view-model';
import {
  onboardingScreenStyles,
  onboardingSkipButtonTextStyle,
} from '../styles/onboarding-screen.styles';
import { OnboardingBackdrop } from './onboarding-backdrop';
import { OnboardingStepIndicator } from './onboarding-step-indicator';
import { StepContent } from './step-content';
import { StepControls } from './step-controls';

export function OnboardingScreen() {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();

  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    handleNext,
    handleBack,
    handleSkip,
    isTransitioning,
  } = useOnboardingViewModel();

  const progressLabel = t('onboarding.a11y.stepProgress', {
    current: currentStepIndex + 1,
    total: totalSteps,
  });
  const mutedRing = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.11)';
  const footerDivider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  if (totalSteps < 1 || !currentStep) return null;

  return (
    <View style={onboardingScreenStyles.root}>
      <OnboardingBackdrop isDark={isDark} />
      <View style={onboardingScreenStyles.column}>
        <SafeAreaView
          edges={['top']}
          style={[onboardingScreenStyles.container, onboardingScreenStyles.safeTransparent]}
        >
          {!isLastStep && (
            <View style={onboardingScreenStyles.skipRow}>
              <Pressable
                onPress={handleSkip}
                accessibilityRole="button"
                hitSlop={12}
                style={({ pressed }) => [
                  onboardingScreenStyles.skipHit,
                  { opacity: isTransitioning ? 0.45 : pressed ? 0.6 : 1 },
                ]}
              >
                <ThemedText
                  style={[
                    onboardingSkipButtonTextStyle,
                    {
                      color: colors.labelText,
                    },
                  ]}
                >
                  {t('onboarding.skip')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={onboardingScreenStyles.contentArea}>
            <Animated.View
              key={currentStep.id}
              entering={FadeIn.duration(260)}
              style={onboardingScreenStyles.flexFill}
            >
              <StepContent
                step={currentStep}
                pageWidth={pageWidth}
                belowContent={
                  <OnboardingStepIndicator
                    currentIndex={currentStepIndex}
                    totalSteps={totalSteps}
                    tint={colors.tint}
                    mutedRing={mutedRing}
                  />
                }
              />
            </Animated.View>
          </View>
        </SafeAreaView>

        <View
          style={[
            onboardingScreenStyles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: footerDivider,
            },
          ]}
        >
          <StepControls
            onNext={handleNext}
            onBack={handleBack}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            controlsDisabled={isTransitioning}
            a11yProgressLabel={progressLabel}
          />
        </View>
      </View>
    </View>
  );
}
