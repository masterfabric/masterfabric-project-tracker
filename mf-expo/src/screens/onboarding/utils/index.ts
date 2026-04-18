import { OnboardingStep } from '../models/onboarding-models';

// Simple project tracker onboarding — 3 steps
export const createOnboardingSteps = (): OnboardingStep[] => [
  {
    id: 'welcome',
    icon: 'checkbox-outline',
    title: 'onboarding.steps.welcome.title',
    subtitle: 'onboarding.steps.welcome.subtitle',
    description: [
      'onboarding.steps.welcome.description.0',
      'onboarding.steps.welcome.description.1'
    ]
  },
  {
    id: 'track',
    icon: 'list-outline',
    title: 'onboarding.steps.track.title',
    subtitle: 'onboarding.steps.track.subtitle',
    description: [
      'onboarding.steps.track.description.0',
      'onboarding.steps.track.description.1'
    ]
  },
  {
    id: 'ready',
    icon: 'checkmark-circle-outline',
    title: 'onboarding.steps.ready.title',
    subtitle: 'onboarding.steps.ready.subtitle',
    description: [
      'onboarding.steps.ready.description.0',
      'onboarding.steps.ready.description.1'
    ]
  }
];

// Helper function to get translated onboarding steps
export const getTranslatedOnboardingSteps = (t: (key: string) => string): OnboardingStep[] => {
  const staticSteps = createOnboardingSteps();
  
  return staticSteps.map(step => {
    // Translate title and subtitle
    const translatedTitle = t(step.title);
    const translatedSubtitle = t(step.subtitle);
    
    // Improved description translation with error handling
    const translatedDescriptions = step.description.map(desc => {
      try {
        const translated = t(desc);
        return translated !== desc ? translated : desc;
      } catch (error) {
        console.warn(`Failed to translate: ${desc}`, error);
        // Return the raw description path for debugging
        return `${desc} (translation missing)`;
      }
    });
    
    return {
      ...step,
      title: translatedTitle || step.title,
      subtitle: translatedSubtitle || step.subtitle,
      description: translatedDescriptions
    };
  });
};

// Helper function to explicitly access description items
export const getDescriptionItems = (step: OnboardingStep): string[] => {
  return Array.isArray(step.description) ? step.description : [];
};

// Add helper function to get description as a paragraph instead of bullet points
export const getDescriptionAsParagraph = (step: OnboardingStep): string => {
  if (!step.description || !Array.isArray(step.description)) {
    return '';
  }
  const normalizeSentence = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  };

  return step.description
    .map(normalizeSentence)
    .filter(Boolean)
    .join(' ');
};

// Add helper function to get a description item by index (useful for UI components)
export const getDescriptionItemByIndex = (step: OnboardingStep, index: number): string => {
  if (!step.description || !step.description[index]) {
    return '';
  }
  return step.description[index];
};

export const getStepProgress = (currentIndex: number, totalSteps: number): number => {
  return Math.round(((currentIndex + 1) / totalSteps) * 100);
};

export const isLastStep = (currentIndex: number, totalSteps: number): boolean => {
  return currentIndex === totalSteps - 1;
};

export const isFirstStep = (currentIndex: number): boolean => {
  return currentIndex === 0;
};
