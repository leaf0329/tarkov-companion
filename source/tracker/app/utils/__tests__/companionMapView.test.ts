import { describe, expect, it, vi } from 'vitest';
import { updateOverviewMinZoom } from '@/utils/companionMapView';
import type L from 'leaflet';
const bounds: L.LatLngBoundsExpression = [[0, 0], [100, 100]];
const size = (x: number, y: number) => ({ x, y, clone: () => ({ x, y }) });
const fixture = (fitZoom: number) => {
  const map = {
    options: { minZoom: 2 },
    getSize: vi.fn(() => size(620, 460)),
    getMinZoom: vi.fn(() => map.options.minZoom),
    getBoundsZoom: vi.fn(() => Math.max(map.options.minZoom, fitZoom)),
    setMinZoom: vi.fn((minimum: number) => { map.options.minZoom = minimum; }),
  };
  return { map, instance: map as unknown as L.Map };
};
describe('companion map overview zoom', () => {
  it('includes space reserved for map controls in the fit calculation', () => {
    const { instance, map } = fixture(0.75);
    updateOverviewMinZoom(instance, bounds, 2, [24, 84]);
    expect(map.getBoundsZoom).toHaveBeenCalledWith(bounds, false, { x: 24, y: 84 });
  });
  it('allows the entire map below the configured zoom limit with extra room to zoom out', () => {
    const { instance, map } = fixture(0.75);
    expect(updateOverviewMinZoom(instance, bounds, 2)).toBe(0.25);
    expect(map.options.minZoom).toBe(0.25);
    expect(map.getBoundsZoom).toHaveBeenCalledWith(bounds, false, { x: 24, y: 24 });
  });
  it('updates the zoom limit again when a smaller window needs a wider view', () => {
    const { instance, map } = fixture(0.75);
    updateOverviewMinZoom(instance, bounds, 2);
    map.getSize.mockReturnValue(size(380, 220));
    map.getBoundsZoom.mockImplementation(() => Math.max(map.options.minZoom, -1));
    expect(updateOverviewMinZoom(instance, bounds, 2)).toBe(-1.5);
  });
  it('keeps a lower configured limit when it already allows more room', () => {
    const { instance, map } = fixture(3);
    map.options.minZoom = 1;
    expect(updateOverviewMinZoom(instance, bounds, 1)).toBe(1);
  });
  it('preserves the limit until a hidden container has usable dimensions', () => {
    const { instance, map } = fixture(0.75);
    map.getSize.mockReturnValue(size(0, 0));
    expect(updateOverviewMinZoom(instance, bounds, 2)).toBe(2);
    expect(map.getBoundsZoom).not.toHaveBeenCalled();
  });
  it('restores the limit if bounds cannot produce a finite fit', () => {
    const { instance, map } = fixture(Infinity);
    expect(updateOverviewMinZoom(instance, bounds, 2)).toBe(2);
    expect(map.setMinZoom).not.toHaveBeenCalled();
  });
  it('restores the limit if the fit calculation throws', () => {
    const { instance, map } = fixture(0.75);
    map.getBoundsZoom.mockImplementation(() => { throw Error('invalid bounds'); });
    expect(() => updateOverviewMinZoom(instance, bounds, 2)).toThrow('invalid bounds');
    expect(map.options.minZoom).toBe(2);
  });
});
