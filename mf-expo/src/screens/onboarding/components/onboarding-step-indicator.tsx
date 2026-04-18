import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/src/shared/i18n';

type Props = {
  currentIndex: number;
  totalSteps: number;
  tint: string;
  mutedRing: string;
};

/** Compact ring/dot step indicator */
export function OnboardingStepIndicator({
  currentIndex,
  totalSteps,
  tint,
  mutedRing,
}: Props) {
  const progressLabel = t('onboarding.a11y.stepProgress', {
    current: currentIndex + 1,
    total: totalSteps,
  });

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t('onboarding.a11y.dotsLabel')}. ${progressLabel}`}
      accessibilityValue={{
        min: 1,
        max: totalSteps,
        now: currentIndex + 1,
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const past = i < currentIndex;
        const active = i === currentIndex;

        if (past) {
          return (
            <View
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: tint,
                opacity: 0.28,
              }}
            />
          );
        }

        if (active) {
          return (
            <View
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: tint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: tint,
                }}
              />
            </View>
          );
        }

        return (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: mutedRing,
              opacity: 0.45,
            }}
          />
        );
      })}
    </View>
  );
}
