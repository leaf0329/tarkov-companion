import { latLngBounds } from 'leaflet';
import { describe, expect, it, vi } from 'vitest';
import { renderCompanionMarkers } from '@/features/maps/utils/companionMarkers';
import type { MapMark } from '@/features/maps/utils/marksHash';
import type L from 'leaflet';
const tasks = [{ id: 'quest-a', name: 'Quest A', trader: { id: 'trader', name: 'Trader', imageLink: 'https://assets.tarkov.dev/trader.webp' }, objectives: ['a-1', 'a-2', 'a-3', 'a-4'].map((id) => ({ id })) }];
function render(marks: MapMark[]) {
  const icons: HTMLElement[] = [];
  const marker = vi.fn((position: L.LatLngExpression) => ({ addTo: vi.fn().mockReturnThis(), getLatLng: () => position }));
  const library = { marker, latLngBounds, divIcon: (options: { html: HTMLElement }) => { icons.push(options.html); return {}; } } as unknown as typeof L;
  const attach = vi.fn();
  renderCompanionMarkers({ marks, tasks, mapId: 'map-a', library, layer: {} as L.LayerGroup, attach });
  return { marker, icons, attach };
}
describe('local task markers', () => {
  it('shows all four objective points of a task at once, each with its own popup', () => {
    const marks = tasks[0]!.objectives.map(({ id }, index) => ({ id, zones: [], possibleLocations: [{ map: { id: 'map-a' }, positions: [{ x: index * 10, z: 1 }] }] }));
    const { marker, icons, attach } = render(marks);
    expect(marker.mock.calls.map(([position]) => position)).toEqual([0, 10, 20, 30].map((lng) => ({ lat: 1, lng })));
    expect(icons[0]?.textContent).toContain('Quest A');
    expect(icons[0]?.querySelector('img')?.getAttribute('src')).toBe('https://assets.tarkov.dev/trader.webp');
    expect(attach.mock.calls.map(([, id]) => id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
    expect(attach.mock.calls[3]![2]()).toEqual({ lat: 1, lng: 30 });
    const remaining = render(marks.slice(1));
    expect(remaining.marker).toHaveBeenCalledTimes(3);
    expect(remaining.attach.mock.calls.map(([, id]) => id)).toEqual(['a-2', 'a-3', 'a-4']);
  });
  it('includes every candidate position and zone on the selected map', () => {
    const zone = (x: number) => ({ map: { id: 'map-a' }, outline: [{ x, z: 0 }, { x: x + 2, z: 0 }, { x: x + 2, z: 2 }] });
    const { marker, attach } = render([{
      id: 'a-1',
      possibleLocations: [
        { map: { id: 'map-a' }, positions: [{ x: 2, z: 1 }, { x: 4, z: 3 }] },
        { map: { id: 'map-a' }, positions: [{ x: 6, z: 5 }, { x: 2, z: 1 }] },
        { map: { id: 'map-b' }, positions: [{ x: 100, z: 100 }] },
      ],
      zones: [zone(10), zone(20), { ...zone(30), map: { id: 'map-b' } }, { map: { id: 'map-a' }, outline: [] }],
    }]);
    expect(marker.mock.calls.map(([position]) => position)).toEqual([
      { lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }, { lat: 1, lng: 11 }, { lat: 1, lng: 21 },
    ]);
    expect(attach.mock.calls.map(([, id]) => id)).toEqual(Array(5).fill('a-1'));
  });
});
