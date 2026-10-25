// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const logger = vi.hoisted(() => ({
  debug: vi.fn(),
}));
vi.mock('@/utils/logger', () => ({
  logger,
}));
describe('useAnalyticsConsent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });
  it('logs malformed stored consent state and falls back to defaults', async () => {
    const { STORAGE_KEYS } = await import('@/utils/storageKeys');
    localStorage.setItem(STORAGE_KEYS.analyticsConsent, '{malformed');
    const { useAnalyticsConsent } = await import('@/composables/useAnalyticsConsent');
    const { state } = useAnalyticsConsent();
    expect(state.value).toEqual({
      status: 'unknown',
      updatedAt: null,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      '[AnalyticsConsent] Failed to parse stored consent state; using defaults.',
      expect.any(Error),
      '{malformed'
    );
  });
});
