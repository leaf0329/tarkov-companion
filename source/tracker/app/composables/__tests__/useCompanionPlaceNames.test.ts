import { describe, expect, it } from 'vitest';
import { isPlaceNameVisible } from '@/composables/useCompanionPlaceNames';
import placeNames from '@/data/companionLandmarks.json';
describe('companion place names', () => {
  it('keeps a label at the exact floor boundary on the upper floor', () => {
    const scienceOffice = placeNames['GroundZero.svg'].labels.find(label => label.text === 'Science Office')!;
    expect(isPlaceNameVisible(scienceOffice, [28, 32.3], 4, 1)).toBe(true);
    expect(isPlaceNameVisible(scienceOffice, [-1000, 28], 4, 1)).toBe(false);
  });
  it('hides surface buildings underground even when only their lower height is specified upstream', () => {
    const building = placeNames['Reserve.svg'].labels.find(label => label.text === 'White Queen')!;
    expect(isPlaceNameVisible(building, [-7, 10000], 4, 1)).toBe(true);
    expect(isPlaceNameVisible(building, [-10000, -7.27], 4, 1)).toBe(false);
  });
  it('adds smaller place names when zooming in without hiding major buildings', () => {
    const map = placeNames['GroundZero.svg'];
    const small = map.labels.find(label => label.text === 'ASAP Winery')!;
    const major = map.labels.find(label => label.text === 'TerraGroup')!;
    expect(isPlaceNameVisible(major, [-1000, 28], 1, 1)).toBe(true);
    expect(isPlaceNameVisible(small, [-1000, 28], 1, 1)).toBe(false);
    expect(isPlaceNameVisible(small, [-1000, 28], 2, 1)).toBe(true);
  });
});
