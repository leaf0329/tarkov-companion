import type { CompanionSnapshot, CompanionUpdate } from '@/types/companion';
function hasProgress(update: CompanionUpdate): boolean {
  return update.progress !== undefined && update.ui !== undefined;
}
function hasSameProgress(current: CompanionSnapshot | null, update: CompanionUpdate): boolean {
  return current !== null && current.profile === update.profile && current.progressRevision === update.progressRevision;
}
function preserveUnchangedReferences(current: CompanionSnapshot | null, next: CompanionSnapshot): CompanionSnapshot {
  if (!current) return next;
  if (JSON.stringify(current.settings) === JSON.stringify(next.settings)) next.settings = current.settings;
  if (JSON.stringify(current.runtime.position) === JSON.stringify(next.runtime.position)) {
    next.runtime = { ...next.runtime, position: current.runtime.position };
  }
  return next;
}
function mergeAvailableState(current: CompanionSnapshot | null, update: CompanionUpdate, needsRefresh: boolean): CompanionSnapshot | null {
  if (!current && !hasProgress(update)) return null;
  // A runtime update can arrive after a missed progress message. Keep the revision of the
  // progress we actually hold until the full snapshot arrives.
  const next = needsRefresh
    ? { ...current!, settings: update.settings, runtime: update.runtime }
    : { ...current, ...update } as CompanionSnapshot;
  return preserveUnchangedReferences(current, next);
}
export function mergeCompanionSnapshot(
  current: CompanionSnapshot | null,
  update: CompanionUpdate
): { snapshot: CompanionSnapshot | null; needsRefresh: boolean } {
  if (current && update.progressRevision < current.progressRevision) {
    return { snapshot: current, needsRefresh: false };
  }
  const needsRefresh = !hasProgress(update) && !hasSameProgress(current, update);
  return { snapshot: mergeAvailableState(current, update, needsRefresh), needsRefresh };
}
