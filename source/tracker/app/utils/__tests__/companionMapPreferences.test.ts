import { describe, expect, it } from 'vitest';
import { syncCompanionMapPreferences } from '@/utils/companionMapPreferences';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import { serializeUserScopedStorage } from '@/utils/userScopedStorage';
describe('shared companion map layer settings', () => {
  it('updates only the map layer settings from another window and does not write equal values repeatedly', () => {
    const values = {
      mapShowCultists: false,
      mapUseDetailedMaps: true,
      mapShowSeasonDocuments: false,
    };
    let writes = 0;
    const preferences = new Proxy(values, {
      set(target, key, value) {
        writes++;
        Reflect.set(target, key, value);
        return true;
      },
    });
    const event = new StorageEvent('storage', {
      key: STORAGE_KEYS.preferences,
      newValue: serializeUserScopedStorage({
        mapShowCultists: true,
        mapUseDetailedMaps: false,
        mapShowSeasonDocuments: true,
        playerLevel: 70,
      }),
    });
    syncCompanionMapPreferences(event, preferences);
    expect(values).toEqual({
      mapShowCultists: true,
      mapUseDetailedMaps: false,
      mapShowSeasonDocuments: true,
    });
    expect(writes).toBe(3);
    syncCompanionMapPreferences(event, preferences);
    expect(writes).toBe(3);
  });
  it('ignores other storage keys and non-boolean values', () => {
    const preferences = {
      mapShowCultists: false,
      mapUseDetailedMaps: true,
      mapShowSeasonDocuments: false,
    };
    syncCompanionMapPreferences(
      new StorageEvent('storage', { key: 'other', newValue: '{}' }),
      preferences
    );
    syncCompanionMapPreferences(
      new StorageEvent('storage', {
        key: STORAGE_KEYS.preferences,
        newValue: '{"mapShowCultists":"true"}',
      }),
      preferences
    );
    expect(preferences).toEqual({
      mapShowCultists: false,
      mapUseDetailedMaps: true,
      mapShowSeasonDocuments: false,
    });
  });
  it('does not apply another account’s saved preferences', () => {
    const preferences = {
      mapShowCultists: false,
      mapUseDetailedMaps: true,
      mapShowSeasonDocuments: false,
    };
    syncCompanionMapPreferences(
      new StorageEvent('storage', {
        key: STORAGE_KEYS.preferences,
        newValue: serializeUserScopedStorage({ mapShowCultists: true }, 'another-account'),
      }),
      preferences
    );
    expect(preferences.mapShowCultists).toBe(false);
  });
});
