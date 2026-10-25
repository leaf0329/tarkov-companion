import { describe, expect, it } from 'vitest';
import { parseBootstrapPreferencesState } from '@/utils/preferencesStorage';
import { serializeUserScopedStorage } from '@/utils/userScopedStorage';
describe('parseBootstrapPreferencesState', () => {
  it('reads legacy preferences payloads', () => {
    expect(parseBootstrapPreferencesState(JSON.stringify({ localeOverride: 'de' }))).toEqual({
      localeOverride: 'de',
    });
  });
  it('unwraps user-scoped preferences for the matching user', () => {
    expect(
      parseBootstrapPreferencesState(
        serializeUserScopedStorage({ localeOverride: 'fr' }, 'user-1'),
        'user-1'
      )
    ).toEqual({
      localeOverride: 'fr',
    });
  });
  it('unwraps anonymous user-scoped preferences for bootstrap readers', () => {
    expect(
      parseBootstrapPreferencesState(
        serializeUserScopedStorage({ localeOverride: 'fr' }, null),
        null
      )
    ).toEqual({
      localeOverride: 'fr',
    });
  });
  it('ignores user-scoped preferences when the active user does not match', () => {
    expect(
      parseBootstrapPreferencesState(
        serializeUserScopedStorage({ localeOverride: 'fr' }, 'user-1'),
        'user-2'
      )
    ).toBeNull();
  });
  it('ignores prior user-scoped preferences when no user is active', () => {
    expect(
      parseBootstrapPreferencesState(
        serializeUserScopedStorage({ localeOverride: 'fr' }, 'user-1'),
        null
      )
    ).toBeNull();
  });
  it('ignores prior user-scoped preferences during auth hydration when no user is active', () => {
    expect(
      parseBootstrapPreferencesState(
        serializeUserScopedStorage({ localeOverride: 'fr' }, 'user-1'),
        {
          allowScopedStateDuringSessionHydration: true,
          expectedUserId: null,
        }
      )
    ).toBeNull();
  });
  it('ignores anonymous user-scoped preferences when an authenticated user is expected', () => {
    expect(
      parseBootstrapPreferencesState(
        serializeUserScopedStorage({ localeOverride: 'fr' }, null),
        'user-1'
      )
    ).toBeNull();
  });
  it('returns null for non-object payloads', () => {
    expect(parseBootstrapPreferencesState(JSON.stringify('de'))).toBeNull();
  });
  it('returns null for invalid json payloads', () => {
    expect(parseBootstrapPreferencesState('invalid json')).toBeNull();
  });
});
