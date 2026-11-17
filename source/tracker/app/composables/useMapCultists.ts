import { cultistCircleOutline, getCultistCircles } from '@/features/maps/utils/cultistAreas';
import { createCultistDetails, type PointTranslate } from '@/features/maps/utils/mapPointDetails';
import { bindMapPointPopup } from '@/features/maps/utils/mapPointPopup';
import type { TarkovMap } from '@/types/tarkov';
import type L from 'leaflet';
export function useMapCultists(
  map: Ref<TarkovMap>,
  instance: Ref<L.Map | null>,
  library: Ref<typeof L | null>,
  floor: Ref<string>,
  enabled: Ref<boolean>,
  t: PointTranslate
): void {
  let group: L.LayerGroup | null = null;
  const clear = () => {
    group?.remove();
    group = null;
  };
  watch(
    [map, instance, library, floor, enabled],
    () => {
      clear();
      const owner = instance.value,
        leaflet = library.value;
      if (!enabled.value || !owner || !leaflet) return;
      const pane = owner.getPane('cultistAreas') ?? owner.createPane('cultistAreas');
      pane.style.zIndex = '310';
      group = leaflet.layerGroup().addTo(owner);
      for (const circle of getCultistCircles(map.value, floor.value)) {
        const ring = leaflet
          .polygon(cultistCircleOutline(circle), {
            pane: 'cultistAreas',
            color: '#f87171',
            weight: 2,
            opacity: 0.9,
            fillColor: '#ef4444',
            fillOpacity: 0.06,
            className: 'companion-cultist-area',
          })
          .addTo(group);
        ring.getElement()?.setAttribute('data-testid', 'cultist-area');
        ring.getElement()?.setAttribute('data-area-id', circle.area.id);
        bindMapPointPopup(owner, leaflet, ring, () => createCultistDetails(circle, t));
      }
    },
    { immediate: true, flush: 'post' }
  );
  onScopeDispose(clear);
}
