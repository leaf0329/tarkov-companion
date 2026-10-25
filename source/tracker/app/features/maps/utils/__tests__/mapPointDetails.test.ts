import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import mapData from '@/data/maps.json';
import {
  createExtractDetails,
  createKeyRoomDetails,
  getPointFloor,
  isPointOnSelectedFloor,
  type PointTranslate,
} from '@/features/maps/utils/mapPointDetails';
import type { MapExtract, TarkovMap } from '@/types/tarkov';
const messages = JSON.parse(readFileSync('app/locales/en.json', 'utf8')) as Record<string, unknown>;
const t: PointTranslate = (key, values = {}) => {
  const message = key
    .split('.')
    .reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], messages);
  return String(message ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
};
const reserve = { id: 'reserve', name: 'Reserve', ...mapData.reserve } as TarkovMap;
const customs = { id: 'customs', name: 'Customs', ...mapData.customs } as TarkovMap;
const labs = { id: 'labs', name: 'Labs', ...mapData.lab } as unknown as TarkovMap;
describe('map point floor and extraction details', () => {
  it('uses the building footprint as well as height, and leaves elevated outdoor terrain on the base layer', () => {
    expect(getPointFloor(customs, { x: 200, y: 6, z: 160 })).toBe('3rd Floor');
    expect(getPointFloor(customs, { x: 200, y: 6, z: -400 })).toBe('Ground_Level');
    expect(getPointFloor(reserve, { x: -121.48, y: -17, z: 172.25 })).toBe('Bunkers');
    expect(getPointFloor(reserve, { x: -9.24, y: 20.93, z: 208.43 })).toBe('Ground_Level');
  });
  it('matches Labs basement and upper-level exits to the tile layers', () => {
    expect(getPointFloor(labs, { x: -111.79, y: 5.38, z: -408.55 })).toBe('Second Level');
    expect(getPointFloor(labs, { x: -112.3, y: -3.11, z: -344.04 })).toBe('Technical');
    expect(isPointOnSelectedFloor(labs, { x: -111.79, y: 5.38, z: -408.55 }, 'Second_Level')).toBe(
      true
    );
    expect(isPointOnSelectedFloor(labs, { x: -111.79, y: 5.38, z: -408.55 }, 'Technical')).toBe(
      false
    );
  });
  it('keeps a combined SVG base layer usable for building floors omitted from its selector', () => {
    const point = { x: -110, y: -2, z: 50 };
    expect(getPointFloor(reserve, point)).toBe('2nd Floor');
    expect(isPointOnSelectedFloor(reserve, point, 'Ground_Level')).toBe(true);
    expect(isPointOnSelectedFloor(reserve, point, 'Bunkers')).toBe(false);
  });
  it('shows the clicked D-2 exit conditions and underground floor', () => {
    const extract: MapExtract = {
      id: 'b166214093a289801ff6e25389caabe8c83792a5',
      name: 'D-2',
      faction: 'pmc',
      position: { x: -121.48, y: -17, z: 172.25 },
    };
    const popup = createExtractDetails(reserve, extract, extract.name, () => undefined, t);
    expect(popup.dataset.extractId).toBe(extract.id);
    expect(popup.textContent).toContain('Underground bunkers');
    expect(popup.textContent).toContain('Turn on power in the underground command bunker');
    expect(popup.textContent).toContain('PMC');
  });
  it('preserves item counts, switch requirements and localized co-op requirements without parsing them as HTML', () => {
    const extract: MapExtract = {
      id: 'co-op',
      name: '合作撤离点',
      faction: 'shared',
      position: { x: 200, y: 6, z: -400 },
      switches: ['power'],
      transferItem: { item: 'money', count: 20000 },
    };
    const map = { ...customs, switches: [{ id: 'power', name: '<img src=x>' }] };
    const popup = createExtractDetails(map, extract, '<img src=x>', () => 'Roubles', t);
    expect(popup.textContent).toContain('Roubles × 20000');
    expect(popup.textContent).toContain('Activate: <img src=x>');
    expect(popup.textContent).toContain('one PMC and one Scav');
    expect(popup.querySelector('img')).toBeNull();
  });
  it('does not turn missing conditions or floor data into a claim of unrestricted extraction', () => {
    const popup = createExtractDetails(
      { id: 'unknown', name: 'Unknown' },
      { id: 'unknown', name: 'Unknown exit' },
      'Unknown exit',
      () => undefined,
      t
    );
    expect(popup.textContent).toContain('Additional restrictions are not recorded');
    expect(popup.textContent).toContain('Floor not recorded');
  });
  it('shows the clicked key-room key, floor and power requirement', () => {
    const popup = createKeyRoomDetails(
      customs,
      {
        id: 'door-3',
        lockType: 'door',
        key: 'dorm-3',
        needsPower: true,
        position: { x: 200, y: 6, z: 160 },
      },
      () => 'Dorm room key',
      t
    );
    expect(popup.dataset.lockId).toBe('door-3');
    expect(popup.textContent).toContain('Dorm room key');
    expect(popup.textContent).toContain('Third floor');
    expect(popup.textContent).toContain('Power must be switched on');
  });
});
