import {
  isPersistedPreferencesStateRecord,
  parseLegacyPersistedPreferencesState,
} from '@/stores/preferences/sanitizers';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import { getCurrentSupabaseUserId, parseUserScopedStorage } from '@/utils/userScopedStorage';
import type { usePreferencesStore } from '@/stores/usePreferences';
type LayerPreferences = Pick<
  ReturnType<typeof usePreferencesStore>,
  'mapShowCultists' | 'mapUseDetailedMaps'
>;
const keys = ['mapShowCultists', 'mapUseDetailedMaps'] as const;
export function syncCompanionMapPreferences(
  event: StorageEvent,
  preferences: LayerPreferences
): void {
  if (event.key !== STORAGE_KEYS.preferences || !event.newValue) return;
  const envelope = parseUserScopedStorage<unknown>(event.newValue);
  if (envelope && envelope._userId !== getCurrentSupabaseUserId()) return;
  const value = envelope ? envelope.data : parseLegacyPersistedPreferencesState(event.newValue);
  if (!isPersistedPreferencesStateRecord(value)) return;
  for (const key of keys) {
    if (typeof value[key] === 'boolean' && preferences[key] !== value[key])
      preferences[key] = value[key];
  }
}
