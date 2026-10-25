import L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import { useMapKeyRooms } from '@/composables/useMapKeyRooms';
import mapData from '@/data/maps.json';
import type { TarkovMap } from '@/types/tarkov';
describe('key-room map layer', () => {
  it('adds door markers only when enabled, changes floors, opens a clicked room and cleans up', async () => {
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
      locks: [
        {
          id: 'ground',
          lockType: 'door',
          key: 'key-ground',
          needsPower: false,
          position: { x: 0, y: 0, z: 0 },
        },
        {
          id: 'upper',
          lockType: 'door',
          key: 'key-upper',
          needsPower: true,
          position: { x: 0, y: 4, z: 0 },
        },
        {
          id: 'safe',
          lockType: 'container',
          key: 'safe-key',
          needsPower: false,
          position: { x: 0, y: 0, z: 0 },
        },
      ],
    } as TarkovMap);
    const enabled = ref(false),
      floor = ref('Ground_Floor'),
      scope = effectScope();
    scope.run(() =>
      useMapKeyRooms(
        map,
        shallowRef(owner),
        shallowRef(L),
        floor,
        enabled,
        (id) => id,
        (key) => key
      )
    );
    const markers = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-testid=key-room-marker]')).map(
        (marker) => marker.dataset.lockId
      );
    try {
      await nextTick();
      expect(markers()).toEqual([]);
      enabled.value = true;
      await nextTick();
      expect(markers()).toEqual(['ground']);
      floor.value = '2nd Floor';
      await nextTick();
      expect(markers()).toEqual(['upper']);
      let selected: L.Marker | undefined;
      owner.eachLayer((layer) => {
        if (layer instanceof L.Marker) selected = layer;
      });
      selected!.fire('click', { latlng: selected!.getLatLng() });
      expect(container.querySelector('[data-testid=key-room-details]')?.textContent).toContain(
        'key-upper'
      );
      enabled.value = false;
      await nextTick();
      expect(markers()).toEqual([]);
      expect(container.querySelector('[data-testid=key-room-details]')).toBeNull();
      enabled.value = true;
      await nextTick();
      scope.stop();
      expect(markers()).toEqual([]);
    } finally {
      scope.stop();
      owner.remove();
      container.remove();
    }
  });
});
