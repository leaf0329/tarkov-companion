import {
  createTransitDetails,
  getTransitLabel,
  isPointOnSelectedFloor,
  type PointTranslate,
} from '@/features/maps/utils/mapPointDetails';
import { bindMapPointPopup } from '@/features/maps/utils/mapPointPopup';
import { gameToLatLng } from '@/utils/mapCoordinates';
import type { TarkovMap } from '@/types/tarkov';
import type L from 'leaflet';
export function useMapTransits(
  map: Ref<TarkovMap>,
  instance: Ref<L.Map | null>,
  library: Ref<typeof L | null>,
  floor: Ref<string>,
  enabled: Ref<boolean>,
  destinationName: (id: string) => string | undefined,
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
      const transits = (map.value.transits ?? []).filter((transit) =>
        isPointOnSelectedFloor(map.value, transit.position, floor.value)
      );
      for (const transit of transits) {
        const destination = destinationName(transit.map);
        const label = getTransitLabel(transit, destination, t);
        const badge = document.createElement('div');
        badge.className =
          'inline-flex w-max -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-violet-300 bg-surface-950/95 px-2 py-1 text-[11px] font-semibold text-violet-200 shadow';
        badge.textContent = '→ ' + label;
        badge.dataset.testid = 'transit-marker';
        badge.dataset.transitId = transit.id;
        badge.dataset.destinationId = transit.map;
        const marker = leaflet.marker(gameToLatLng(transit.position.x, transit.position.z), {
          icon: leaflet.divIcon({
            className: 'companion-transit',
            html: badge,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          title: label,
          keyboard: false,
          zIndexOffset: 650,
        });
        bindMapPointPopup(owner, leaflet, marker, () =>
          createTransitDetails(map.value, transit, destination, t)
        );
        marker.addTo(group);
      }
    },
    { immediate: true, flush: 'post' }
  );
  onScopeDispose(clear);
}
