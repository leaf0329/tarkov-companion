import {
  createSeasonDocumentDetails,
  type PointTranslate,
} from '@/features/maps/utils/mapPointDetails';
import { bindMapPointPopup } from '@/features/maps/utils/mapPointPopup';
import {
  getSeasonDocumentPoints,
  type SeasonDocumentType,
} from '@/features/maps/utils/seasonDocuments';
import { gameToLatLng } from '@/utils/mapCoordinates';
import type { TarkovMap } from '@/types/tarkov';
import type L from 'leaflet';
function documentDot(documents: SeasonDocumentType[]): HTMLElement {
  const element = document.createElement('span');
  element.className = 'block h-3.5 w-3.5 rounded-full border-2 border-surface-950 shadow';
  element.dataset.testid = 'season-document-marker';
  element.dataset.documentTypes = documents.map((document) => document.id).join(',');
  element.style.background =
    documents.length === 1
      ? documents[0]!.color
      : 'conic-gradient(' +
        documents
          .map(
            (document, index) =>
              document.color +
              ' ' +
              (index / documents.length) * 100 +
              '% ' +
              ((index + 1) / documents.length) * 100 +
              '%'
          )
          .join(',') +
        ')';
  return element;
}
export function useMapSeasonDocuments(
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
      const pane = owner.getPane('seasonDocuments') ?? owner.createPane('seasonDocuments');
      pane.style.zIndex = '450';
      group = leaflet.layerGroup().addTo(owner);
      for (const point of getSeasonDocumentPoints(map.value, floor.value)) {
        const dot = documentDot(point.documents);
        dot.dataset.spawnId = point.id;
        const marker = leaflet
          .marker(gameToLatLng(point.position.x, point.position.z), {
            pane: 'seasonDocuments',
            keyboard: false,
            icon: leaflet.divIcon({
              className: 'companion-season-document',
              html: dot,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
          })
          .addTo(group);
        bindMapPointPopup(owner, leaflet, marker, () =>
          createSeasonDocumentDetails(map.value, point, t)
        );
      }
    },
    { immediate: true, flush: 'post' }
  );
  onScopeDispose(clear);
}
