import { describe, expect, it } from 'vitest';
import {
  getNeededItemData,
  getNeededItemId,
  isNonFirSpecialEquipment,
} from '@/features/neededitems/neededItemFilters';
import type { NeededItemTaskObjective, TarkovItem } from '@/types/tarkov';
const createItem = (overrides: Partial<TarkovItem> = {}): TarkovItem => {
  return {
    id: 'item-id',
    name: 'Item',
    ...overrides,
  };
};
const createNeed = (overrides: Partial<NeededItemTaskObjective> = {}): NeededItemTaskObjective => {
  return {
    id: 'need-id',
    needType: 'taskObjective',
    taskId: 'task-id',
    item: createItem(),
    count: 1,
    foundInRaid: false,
    ...overrides,
  };
};
describe('isNonFirSpecialEquipment', () => {
  it('returns true for marker items when non-FIR', () => {
    const need = createNeed({
      markerItem: createItem({ id: 'marker-id', name: 'MS2000 Marker' }),
      foundInRaid: false,
    });
    expect(isNonFirSpecialEquipment(need)).toBe(true);
  });
  it('returns false for FIR items even if they have a marker item', () => {
    const need = createNeed({
      markerItem: createItem({ id: 'marker-id', name: 'MS2000 Marker' }),
      foundInRaid: true,
    });
    expect(isNonFirSpecialEquipment(need)).toBe(false);
  });
  it('returns true when the item category matches "special equipment"', () => {
    const need = createNeed({
      item: createItem({
        category: { id: 'cat', name: 'Special Equipment' },
      }),
    });
    expect(isNonFirSpecialEquipment(need)).toBe(true);
  });
  it('returns true when the item types include "special equipment"', () => {
    const need = createNeed({
      item: createItem({
        types: ['Quest', 'Special Equipment'],
      }),
    });
    expect(isNonFirSpecialEquipment(need)).toBe(true);
  });
  it('returns false when item is not special equipment', () => {
    const need = createNeed({
      item: createItem({
        category: { id: 'cat', name: 'Keys' },
        types: ['Quest'],
      }),
    });
    expect(isNonFirSpecialEquipment(need)).toBe(false);
  });
});
describe('getNeededItemId', () => {
  it('returns the item id for standard objectives', () => {
    const need = createNeed({ item: createItem({ id: 'item-id' }) });
    expect(getNeededItemId(need)).toBe('item-id');
  });
  it('falls back to marker item id', () => {
    const need = createNeed({
      item: undefined,
      markerItem: createItem({ id: 'marker-id' }),
    });
    expect(getNeededItemId(need)).toBe('marker-id');
  });
  it('falls back to marker item id when item exists but id is undefined', () => {
    const need = createNeed({
      item: createItem({ id: undefined as unknown as string }),
      markerItem: createItem({ id: 'marker-id' }),
    });
    // Function falls back to markerItem.id when item.id is falsy
    expect(getNeededItemId(need)).toBe('marker-id');
  });
});
describe('getNeededItemData', () => {
  it('returns the item when available', () => {
    const item = createItem({ id: 'item-id', name: 'Item' });
    const need = createNeed({ item });
    expect(getNeededItemData(need)).toEqual(item);
  });
  it('falls back to the marker item data', () => {
    const marker = createItem({ id: 'marker-id', name: 'Marker' });
    const need = createNeed({ item: undefined, markerItem: marker });
    expect(getNeededItemData(need)).toEqual(marker);
  });
  it('falls back to marker item when item exists but has no valid id', () => {
    const marker = createItem({ id: 'marker-id', name: 'Marker' });
    const need = createNeed({
      item: createItem({ id: undefined as unknown as string, name: 'No ID Item' }),
      markerItem: marker,
    });
    // getNeededItemData now checks item.id and falls back to markerItem when id is missing
    expect(getNeededItemData(need)).toEqual(marker);
  });
});
