import L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import { useMapTransits } from '@/composables/useMapTransits';
import mapData from '@/data/maps.json';
import type { TarkovMap } from '@/types/tarkov';
describe('transit map layer', () => {
  it('shows every transit on its floor, opens the clicked destination, toggles and cleans up across maps', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const owner = L.map(container, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
    }).setView([0, 0], 1);
    const map = ref({
      id: 'factory',
      name: 'Factory',
      ...mapData.factory,
      transits: [
        {
          id: '12',
          description: 'To Woods',
          map: 'woods',
          position: { x: 24.36, y: 2.24, z: 60.22 },
        },
        {
          id: '13',
          description: 'To Customs',
          map: 'customs',
          position: { x: 17.34, y: 0.58, z: -49.62 },
        },
        {
          id: '14',
          description: 'To Labs',
          map: 'dark-lab',
          position: { x: -27.01, y: -3.09, z: -42.75 },
        },
      ],
    } as TarkovMap);
    const enabled = ref(true),
      floor = ref('Ground_Floor'),
      scope = effectScope();
    scope.run(() =>
      useMapTransits(
        map,
        shallowRef(owner),
        shallowRef(L),
        floor,
        enabled,
        (id) => id,
        (key, values) => key + (values ? ' ' + String(values.name) : '')
      )
    );
    const markers = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-testid=transit-marker]'));
    try {
      await nextTick();
      expect(markers().map((marker) => marker.dataset.transitId)).toEqual(['12', '13']);
      expect(markers().map((marker) => marker.dataset.destinationId)).toEqual(['woods', 'customs']);
      expect(container.querySelector('.companion-transit[tabindex]')).toBeNull();
      floor.value = 'Tunnels';
      await nextTick();
      expect(markers().map((marker) => marker.dataset.transitId)).toEqual(['14']);
      let selected: L.Marker | undefined;
      owner.eachLayer((layer) => {
        if (layer instanceof L.Marker) selected = layer;
      });
      selected!.fire('click', { latlng: selected!.getLatLng() });
      expect(container.querySelector('[data-testid=transit-details]')?.textContent).toContain(
        'dark-lab'
      );
      enabled.value = false;
      await nextTick();
      expect(markers()).toEqual([]);
      expect(container.querySelector('[data-testid=transit-details]')).toBeNull();
      enabled.value = true;
      await nextTick();
      expect(markers()).toHaveLength(1);
      map.value = { ...map.value, id: 'other', name: 'Other', transits: [] };
      await nextTick();
      expect(markers()).toEqual([]);
      scope.stop();
      expect(markers()).toEqual([]);
    } finally {
      scope.stop();
      owner.remove();
      container.remove();
    }
  });
});
