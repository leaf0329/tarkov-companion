import {
  createKeyRoomDetails,
  isPointOnSelectedFloor,
  type ItemNameLookup,
  type PointTranslate,
} from '@/features/maps/utils/mapPointDetails';
import { bindMapPointPopup } from '@/features/maps/utils/mapPointPopup';
import { gameToLatLng } from '@/utils/mapCoordinates';
import type { TarkovMap } from '@/types/tarkov';
import type L from 'leaflet';
export function useMapKeyRooms(
  map: Ref<TarkovMap>,
  instance: Ref<L.Map | null>,
  library: Ref<typeof L | null>,
  floor: Ref<string>,
  enabled: Ref<boolean>,
  itemName: ItemNameLookup,
  t: PointTranslate
): void {
  let group: L.LayerGroup | null = null;
  const clear = () => {
    group?.remove();
    group = null;
  };
  const context = () => {
    if (!enabled.value) return null;
    const owner = instance.value,
      leaflet = library.value;
    return owner && leaflet ? { owner, leaflet } : null;
  };
  watch(
    [map, instance, library, floor, enabled],
    () => {
      clear();
      const next = context();
      if (!next) return;
      const { owner, leaflet } = next;
      group = leaflet.layerGroup().addTo(owner);
      const locks = (map.value.locks ?? []).filter(
        (lock) =>
          lock.lockType === 'door' &&
          lock.key &&
          isPointOnSelectedFloor(map.value, lock.position, floor.value)
      );
      for (const lock of locks) {
        const badge = document.createElement('div');
        badge.className =
          'flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-surface-950/90 text-sm shadow';
        badge.textContent = '🔑';
        badge.dataset.testid = 'key-room-marker';
        badge.dataset.lockId = lock.id;
        const marker = leaflet.marker(gameToLatLng(lock.position.x, lock.position.z), {
          icon: leaflet.divIcon({
            className: 'companion-key-room',
            html: badge,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          title: itemName(lock.key) ?? t('companion.key_rooms'),
          keyboard: false,
          zIndexOffset: 600,
        });
        bindMapPointPopup(owner, leaflet, marker, () =>
          createKeyRoomDetails(map.value, lock, itemName, t)
        );
        marker.addTo(group);
      }
    },
    { immediate: true, flush: 'post' }
  );
  onScopeDispose(clear);
}
