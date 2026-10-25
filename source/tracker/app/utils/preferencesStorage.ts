import { getCurrentSupabaseUserId, parseUserScopedStorage } from '@/utils/userScopedStorage';
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};
type ParseBootstrapPreferencesOptions = {
  allowScopedStateDuringSessionHydration?: boolean;
  expectedUserId?: string | null;
};
const resolveBootstrapPreferencesOptions = (
  expectedUserIdOrOptions?: string | null | ParseBootstrapPreferencesOptions
): {
  allowScopedStateDuringSessionHydration: boolean;
  expectedUserId: string | null;
} => {
  if (typeof expectedUserIdOrOptions === 'string' || expectedUserIdOrOptions === null) {
    return {
      allowScopedStateDuringSessionHydration: false,
      expectedUserId: expectedUserIdOrOptions,
    };
  }
  return {
    allowScopedStateDuringSessionHydration:
      expectedUserIdOrOptions?.allowScopedStateDuringSessionHydration === true,
    expectedUserId:
      expectedUserIdOrOptions && 'expectedUserId' in expectedUserIdOrOptions
        ? (expectedUserIdOrOptions.expectedUserId ?? null)
        : getCurrentSupabaseUserId(),
  };
};
export const parseBootstrapPreferencesState = (
  rawValue: string,
  expectedUserIdOrOptions?: string | null | ParseBootstrapPreferencesOptions
): Record<string, unknown> | null => {
  const { allowScopedStateDuringSessionHydration, expectedUserId } =
    resolveBootstrapPreferencesOptions(expectedUserIdOrOptions);
  try {
    const wrapped = parseUserScopedStorage<unknown>(rawValue);
    if (wrapped) {
      if (
        wrapped._userId !== expectedUserId &&
        !(
          allowScopedStateDuringSessionHydration &&
          wrapped._userId === null &&
          expectedUserId === null
        )
      ) {
        return null;
      }
      return isPlainObject(wrapped.data) ? wrapped.data : null;
    }
    const candidate = JSON.parse(rawValue) as unknown;
    return isPlainObject(candidate) ? candidate : null;
  } catch {
    return null;
  }
};
