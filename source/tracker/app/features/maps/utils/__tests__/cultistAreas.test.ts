import { describe, expect, it } from 'vitest';
import definitions from '@/data/companionCultistAreas.json';
import mapData from '@/data/maps.json';
import { cultistCircleOutline, getCultistCircles } from '@/features/maps/utils/cultistAreas';
import type { TarkovMap } from '@/types/tarkov';
describe('Cultist reference circles', () => {
  it('encloses published areas without using a geographic Earth radius or adding permanent labels', () => {
    const map = {
      id: '56f40101d2720b2a4d8b45d6',
      name: 'Customs',
      ...mapData.customs,
    } as TarkovMap;
    const circles = getCultistCircles(map, 'Ground_Level');
    expect(circles).toHaveLength(1);
    const circle = circles[0]!;
    for (const point of circle.area.outline!) {
      expect(Math.hypot(point.x - circle.center.x, point.z - circle.center.z)).toBeLessThanOrEqual(
        circle.radius + 0.001
      );
    }
    for (const vertex of cultistCircleOutline(circle)) {
      expect(Math.hypot(vertex.lng - circle.center.x, vertex.lat - circle.center.z)).toBeCloseTo(
        circle.radius,
        6
      );
    }
    expect(getCultistCircles(map, 'Underground')).toEqual([]);
  });
  it('includes the previously unpositioned Sunken Village area and keeps event variants separate', () => {
    const map = {
      id: '5704e554d2720bac5b8b456e',
      name: 'Shoreline',
      ...mapData.shoreline,
    } as TarkovMap;
    expect(getCultistCircles(map, 'Ground_Level').map((circle) => circle.area.location)).toContain(
      'sunken_village'
    );
    expect(getCultistCircles({ ...map, id: '6a8dd0941fc6ba7a9505908f' }, 'Ground_Level')).toEqual(
      []
    );
  });
  it('filters recorded spawns by the selected floor and supports the merged level-21 map', () => {
    const map = {
      id: '653e6760052c01c1c805532f',
      mergedIds: ['65b8d6f5cdde2479cb2a3125'],
      name: 'Ground Zero',
      ...mapData.groundzero,
    } as TarkovMap;
    expect(getCultistCircles(map, 'Ground_Level')).toHaveLength(1);
    expect(getCultistCircles(map, 'Garage')).toHaveLength(1);
    expect(getCultistCircles(map, 'Ground_Level')[0]!.center).not.toEqual(
      getCultistCircles(map, 'Garage')[0]!.center
    );
    expect(definitions.areas.every((area) => area.source.startsWith('https://'))).toBe(true);
  });
});
