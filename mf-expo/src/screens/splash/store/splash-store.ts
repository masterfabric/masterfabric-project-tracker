import { create } from 'zustand';
import type { AppConfigParams } from '@/src/shared/services/app-config-service';

interface SplashState {
  isLoading: boolean;
  progress: number;
  loadingMessage: string;
  currentStep: string;
  completedSteps: string[];
  /** App config fetched during splash (appSettings from mf-go) */
  appConfig: AppConfigParams | null;

  // Actions
  setLoading: (loading: boolean) => void;
  setProgress: (progress: number) => void;
  setLoadingMessage: (message: string) => void;
  setCurrentStep: (step: string) => void;
  addCompletedStep: (step: string) => void;
  setAppConfig: (config: AppConfigParams | null) => void;
  reset: () => void;
}

const initialState = {
  isLoading: true,
  progress: 0,
  loadingMessage: 'Initializing...',
  currentStep: '',
  completedSteps: [] as string[],
  appConfig: null as AppConfigParams | null,
};

export const useSplashStore = create<SplashState>((set) => ({
  ...initialState,
  
  setLoading: (loading: boolean) => 
    set({ isLoading: loading }),
    
  setProgress: (progress: number) => 
    set({ progress }),
    
  setLoadingMessage: (message: string) => 
    set({ loadingMessage: message }),

  setCurrentStep: (step: string) =>
    set({ currentStep: step }),

  addCompletedStep: (step: string) =>
    set((state) => ({
      completedSteps: [...state.completedSteps, step]
    })),

  setAppConfig: (appConfig: AppConfigParams | null) =>
    set({ appConfig }),

  reset: () =>
    set(initialState),
}));