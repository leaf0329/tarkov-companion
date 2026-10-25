import { describe, expect, it } from 'vitest';
import { mergeCompanionSnapshot } from '@/utils/companionState';
import type { CompanionSnapshot, CompanionUpdate } from '@/types/companion';
const fixture = (): CompanionSnapshot => ({
  settings: { logsPath: '', screenshotsPath: '', hotkey: 'F11', opacity: 89, interval: 8, autoScreenshot: false, cleanupScreenshots: true, follow: false },
  profile: 'profile-a', progressRevision: 1,
  progress: { task: { status: 'active', at: 10, source: 'manual' } }, ui: {},
  runtime: { ready: true, map: 'map', mode: 'pve', raid: 'raid', error: null, position: { map: 'map', x: 1, y: 2, z: 3, yaw: 0, at: 10 } },
});
const runtimeOnly = (current: CompanionSnapshot): CompanionUpdate => {
  const { progress: _progress, ui: _ui, ...update } = structuredClone(current);
  return update;
};
describe('companion window state synchronization', () => {
  it('initializes from a complete snapshot', () => {
    const state = fixture();
    expect(mergeCompanionSnapshot(null, state)).toEqual({ snapshot: state, needsRefresh: false });
  });
  it('requests the full state when a runtime message arrives before initialization', () => {
    expect(mergeCompanionSnapshot(null, runtimeOnly(fixture()))).toEqual({ snapshot: null, needsRefresh: true });
  });
  it('updates toolbar switches without replacing task progress or unchanged coordinates', () => {
    const state = fixture(), update = runtimeOnly(state);
    update.settings.autoScreenshot = true;
    update.settings.follow = true;
    const result = mergeCompanionSnapshot(state, update);
    expect(result.needsRefresh).toBe(false);
    expect(result.snapshot?.settings).toMatchObject({ autoScreenshot: true, follow: true });
    expect(result.snapshot?.progress).toBe(state.progress);
    expect(result.snapshot?.runtime.position).toBe(state.runtime.position);
  });
  it('does not claim to have progress from a missed message and recovers from a full reply', () => {
    const state = fixture(), update = runtimeOnly(state);
    update.progressRevision = 2;
    update.settings.follow = true;
    const missing = mergeCompanionSnapshot(state, update);
    expect(missing.needsRefresh).toBe(true);
    expect(missing.snapshot?.progressRevision).toBe(1);
    expect(missing.snapshot?.progress).toBe(state.progress);
    expect(missing.snapshot?.settings.follow).toBe(true);
    const complete = { ...fixture(), progressRevision: 2, progress: { other: { status: 'active', at: 11, source: 'TarkovMonitor' } } };
    const recovered = mergeCompanionSnapshot(missing.snapshot, complete);
    expect(recovered.needsRefresh).toBe(false);
    expect(recovered.snapshot?.progress).toEqual(complete.progress);
  });
  it('requests progress for a new profile without assigning old progress to it', () => {
    const state = fixture(), update = runtimeOnly(state);
    update.profile = 'profile-b';
    update.progressRevision = 2;
    const result = mergeCompanionSnapshot(state, update);
    expect(result.needsRefresh).toBe(true);
    expect(result.snapshot?.profile).toBe('profile-a');
  });
  it('ignores an older initial reply that arrives after a newer subscription message', () => {
    const state = { ...fixture(), progressRevision: 2 };
    const result = mergeCompanionSnapshot(state, fixture());
    expect(result.snapshot).toBe(state);
    expect(result.needsRefresh).toBe(false);
  });
  it('preserves settings and coordinates during heartbeat messages', () => {
    const state = fixture();
    const result = mergeCompanionSnapshot(state, runtimeOnly(state));
    expect(result.snapshot?.settings).toBe(state.settings);
    expect(result.snapshot?.runtime.position).toBe(state.runtime.position);
  });
});
