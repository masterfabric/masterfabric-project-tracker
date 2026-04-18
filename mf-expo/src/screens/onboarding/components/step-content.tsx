import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/src/shared/components/ThemedText';
import { getThemeColors, useTheme } from 'masterfabric-expo-core';
import { OnboardingStep } from '../models/onboarding-models';
import { stepContentStyles } from '../styles/step-content.styles';
import { getDescriptionAsParagraph } from '../utils';

interface StepContentProps {
  step: OnboardingStep;
  pageWidth: number;
  /** Rendered below the copy block (e.g. step indicator). */
  belowContent?: React.ReactNode;
}

export function StepContent({ step, pageWidth: _pageWidth, belowContent }: StepContentProps) {
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const { height } = useWindowDimensions();
  const isCompact = height < 700;
  const iconSize = isCompact ? 36 : 40;

  const hasDescription =
    Array.isArray(step.description) && step.description.length > 0;

  return (
    <ScrollView
      contentContainerStyle={stepContentStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={stepContentStyles.column}>
        <Ionicons
          name={step.icon as any}
          size={iconSize}
          color={colors.tint}
          style={stepContentStyles.icon}
        />

        <ThemedText style={[stepContentStyles.title, { color: colors.bodyText }]}>
          {step.title}
        </ThemedText>

        <ThemedText style={[stepContentStyles.subtitle, { color: colors.labelText }]}>
          {step.subtitle}
        </ThemedText>

        {hasDescription && (
          <ThemedText style={[stepContentStyles.body, { color: colors.labelText }]}>
            {getDescriptionAsParagraph(step)}
          </ThemedText>
        )}

        {belowContent ? <View style={stepContentStyles.belowFold}>{belowContent}</View> : null}
      </View>
    </ScrollView>
  );
}
