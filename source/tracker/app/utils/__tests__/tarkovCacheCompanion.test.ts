import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('desktop companion metadata cache', () => {
  afterEach(() => {
    delete window.companion;
    vi.unstubAllGlobals();
  });

  it('bypasses old browser catalogs without deleting progress or changing normal browser caching', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    delete window.companion;
    const { getCachedData, setCachedData } = await import('@/utils/tarkovCache');
    const oldCatalog = { maps: [{ id: 'factory' }] };
    await setCachedData('tasks-core', 'json-v3-pve', 'zh', oldCatalog);
    expect(await getCachedData('tasks-core', 'json-v3-pve', 'zh')).toEqual(oldCatalog);

    const progress = JSON.stringify({ pve: { taskCompletions: { accepted: { complete: true } } } });
    localStorage.setItem('companion-cache-test-progress', progress);
    window.companion = {} as NonNullable<Window['companion']>;

    expect(await getCachedData('tasks-core', 'json-v3-pve', 'zh')).toBeNull();
    await setCachedData('tasks-core', 'json-v3-pve', 'zh', { maps: [{ id: 'infected-factory' }] });
    expect(localStorage.getItem('companion-cache-test-progress')).toBe(progress);

    delete window.companion;
    expect(await getCachedData('tasks-core', 'json-v3-pve', 'zh')).toEqual(oldCatalog);
    localStorage.removeItem('companion-cache-test-progress');
  });
});
