import { describe, expect, it } from 'vitest';
import definitions from '@/data/companionSeasonDocuments.json';
import mapData from '@/data/maps.json';
import {
  getMapSeasonDocumentTypes,
  getSeasonDocumentPoints,
} from '@/features/maps/utils/seasonDocuments';
import type { TarkovMap } from '@/types/tarkov';
const factory = {
  id: '55f2d3fd4bdc2d5f408b4567',
  name: 'Factory',
  ...mapData.factory,
} as TarkovMap;
describe('Season 1 document positions', () => {
  it('assigns each reference position to exactly one selectable floor', () => {
    for (const map of [
      factory,
      { id: '653e6760052c01c1c805532f', name: 'Ground Zero', ...mapData.groundzero } as TarkovMap,
    ]) {
      const config = typeof map.svg === 'object' ? map.svg : map.tile!;
      const points = config.floors!.flatMap((floor) => getSeasonDocumentPoints(map, floor));
      const source = definitions.maps.find((entry) => entry.mapIds.includes(map.id))!;
      expect(points).toHaveLength(source.spawns.length);
      expect(new Set(points.map((point) => point.id)).size).toBe(points.length);
    }
  });
  it('shows shared positions once when day/night map IDs are merged', () => {
    const floor = 'Ground_Floor';
    const ordinary = getSeasonDocumentPoints(factory, floor).map((point) => point.id);
    const merged = getSeasonDocumentPoints(
      { ...factory, mergedIds: ['59fc81d786f774390775787e'] },
      floor
    );
    const night = getSeasonDocumentPoints({ ...factory, id: '59fc81d786f774390775787e' }, floor);
    expect(merged.map((point) => point.id)).toEqual(ordinary);
    expect(night.map((point) => point.id)).toEqual(ordinary);
  });
  it('retains both document types at a shared reference position and excludes unverified variants', () => {
    const points = mapData.factory.svg.floors.flatMap((floor) =>
      getSeasonDocumentPoints(factory, floor)
    );
    const shared = points.find((point) => point.documentIds.length > 1)!;
    expect(shared.documents.map((document) => document.id)).toEqual(shared.documentIds);
    expect(new Set(shared.documents.map((document) => document.color)).size).toBe(
      shared.documents.length
    );
    expect(getMapSeasonDocumentTypes(factory).map((document) => document.id)).toEqual(
      expect.arrayContaining(shared.documentIds)
    );
    const event = { ...factory, id: '6a8dd1325e15a5ea2e010820' };
    expect(getSeasonDocumentPoints(event, 'Ground_Floor')).toEqual([]);
    expect(getMapSeasonDocumentTypes(event)).toEqual([]);
  });
});
