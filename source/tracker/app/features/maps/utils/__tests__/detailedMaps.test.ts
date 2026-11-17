import { describe, expect, it } from 'vitest';
import mapData from '@/data/maps.json';
import {
  detailedMapFor,
  referenceMapFor,
  withDetailedMap,
} from '@/features/maps/utils/detailedMaps';
import type { TarkovMap } from '@/types/tarkov';
describe('illustrated map selection', () => {
  it('retains the world coordinate system, floor list and input data when selecting independently aligned tiles', () => {
    const map = {
      id: '55f2d3fd4bdc2d5f408b4567',
      name: 'Factory',
      ...mapData.factory,
    } as TarkovMap;
    const before = JSON.stringify(map);
    const next = withDetailedMap(map, 'Tunnels', true);
    expect(next.svg).toBe(map.svg);
    expect(next.tile?.bounds).toEqual(mapData.factory.svg.bounds);
    expect(next.tile?.transform).toEqual(mapData.factory.svg.transform);
    expect(next.tile?.tilePath).toContain('/factory/Tunnels/');
    expect(next.tile?.maxNativeZoom).toBe(4);
    expect(JSON.stringify(map)).toBe(before);
    expect(withDetailedMap(map, 'Tunnels', false)).toBe(map);
  });
  it('uses the original layer for an unsupported floor and does not reuse a normal map for an event variant', () => {
    const map = {
      id: '653e6760052c01c1c805532f',
      name: 'Ground Zero',
      ...mapData.groundzero,
    } as TarkovMap;
    expect(withDetailedMap(map, 'Garage', true)).toBe(map);
    expect(detailedMapFor({ ...map, id: '6a8dd0941fc6ba7a9505908f' })).toBeUndefined();
  });
  it('keeps unregistered illustrations in a separate reference viewer', () => {
    const map = {
      id: '56f40101d2720b2a4d8b45d6',
      name: 'Customs',
      ...mapData.customs,
    } as TarkovMap;
    expect(detailedMapFor(map)).toBeUndefined();
    expect(referenceMapFor(map)?.width).toBeGreaterThan(4000);
    expect(withDetailedMap(map, 'Ground_Level', true)).toBe(map);
  });
  it('loads a map without named floors without inserting an empty path segment', () => {
    const map = {
      id: '6733700029c367a3d40b02af',
      name: 'Labyrinth',
      ...mapData.labyrinth,
    } as TarkovMap;
    expect(withDetailedMap(map, '', true).tile?.tilePath).toBe(
      '/companion/terrain/labyrinth/{z}/{x}/y{y}.webp'
    );
  });
});
