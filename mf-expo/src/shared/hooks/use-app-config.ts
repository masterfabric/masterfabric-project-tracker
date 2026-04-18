/**
 * Hook to fetch and use app config from mf-go appSettings.
 */

import { useQuery } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect } from 'react';
import { fetchAppConfig, invalidateAppConfigCache } from '@/src/shared/services/app-config-service';
import type { AppConfigParams } from '@/src/shared/services/app-config-service';

const QUERY_KEY = ['appConfig'];

export function useAppConfig() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAppConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  // Refetch when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        invalidateAppConfigCache();
        query.refetch();
      }
    });
    return () => subscription.remove();
  }, [query.refetch]);

  return {
    config: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export type { AppConfigParams };
