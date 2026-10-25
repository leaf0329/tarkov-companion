import { logger } from '@/utils/logger';
let hasWarnedMissingToastContext = false;
export function useSafeToast(): ReturnType<typeof useToast> | null {
  try {
    const nuxtApp = useNuxtApp();
    if (typeof nuxtApp.runWithContext === 'function') {
      const toast = nuxtApp.runWithContext(() => useToast());
      if (!(toast instanceof Promise)) {
        return toast;
      }
    }
    if (getCurrentInstance()) {
      return useToast();
    }
  } catch (error) {
    logger.warn('[useSafeToast] Failed to resolve toast instance.', error);
    return null;
  }
  if (!hasWarnedMissingToastContext) {
    hasWarnedMissingToastContext = true;
    logger.warn('[useSafeToast] Toast context unavailable. Skipping toast notification.');
  }
  return null;
}
