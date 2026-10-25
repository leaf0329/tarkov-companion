import type { CompanionWindowResetReason } from '@/types/companion';
export function useCompanionWindowReset(reset: (reason: CompanionWindowResetReason) => void): void {
  let unsubscribe: (() => void) | undefined;
  onMounted(() => { unsubscribe = window.companion?.subscribeWindowReset?.(reset); });
  onScopeDispose(() => unsubscribe?.());
}
