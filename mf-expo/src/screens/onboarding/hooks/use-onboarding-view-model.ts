import { navigationUtils } from '@/src/navigation/utils';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { t } from '@/src/shared/i18n';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useOnboardingStore } from '../store/onboarding-store';
import { getTranslatedOnboardingSteps, isFirstStep, isLastStep } from '../utils';

export function useOnboardingViewModel() {
  const {
    currentStepIndex,
    nextStep,
    previousStep,
    completeOnboarding,
  } = useOnboardingStore();
  const { locale } = useLocale();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const finishingRef = useRef(false);

  const steps = useMemo(() => getTranslatedOnboardingSteps(t), [locale]);
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;

  const finishAndGoHome = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsTransitioning(true);
    try {
      await completeOnboarding();
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      navigationUtils.replace('(tabs)');
    } catch (error) {
      console.error('Onboarding completion failed:', error);
      finishingRef.current = false;
      setIsTransitioning(false);
    }
  }, [completeOnboarding]);

  const handleNext = useCallback(async () => {
    if (finishingRef.current) return;
    if (isLastStep(currentStepIndex, totalSteps)) {
      await finishAndGoHome();
    } else {
      nextStep();
    }
  }, [currentStepIndex, finishAndGoHome, nextStep, totalSteps]);

  const handleBack = useCallback(() => {
    if (finishingRef.current) return;
    if (!isFirstStep(currentStepIndex)) {
      previousStep();
    }
  }, [currentStepIndex, previousStep]);

  const handleSkip = useCallback(async () => {
    if (finishingRef.current) return;
    await finishAndGoHome();
  }, [finishAndGoHome]);

  return {
    steps,
    currentStep,
    currentStepIndex,
    totalSteps,
    isFirstStep: isFirstStep(currentStepIndex),
    isLastStep: isLastStep(currentStepIndex, totalSteps),
    handleNext,
    handleBack,
    handleSkip,
    isTransitioning,
  };
}
