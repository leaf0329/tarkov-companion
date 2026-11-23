import L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import { useMapSeasonDocuments } from '@/composables/useMapSeasonDocuments';
import mapData from '@/data/maps.json';
import { getSeasonDocumentPoints } from '@/features/maps/utils/seasonDocuments';
import type { TarkovMap } from '@/types/tarkov';
describe('Season document map layer', () => {
  it('renders distinct colours, opens details only on click, follows floors and cleans up when disabled', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const owner = L.map(container, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
    }).setView([0, 0], 2);
    const map = ref({
      id: '55f2d3fd4bdc2d5f408b4567',
      name: 'Factory',
      ...mapData.factory,
    } as TarkovMap);
    const selected = mapData.factory.svg.floors.find((floor) =>
      getSeasonDocumentPoints(map.value, floor).some((point) => point.documents.length > 1)
    )!;
    const floor = ref(selected),
      enabled = ref(false),
      scope = effectScope();
    scope.run(() =>
      useMapSeasonDocuments(map, shallowRef(owner), shallowRef(L), floor, enabled, (key) => key)
    );
    const badges = () => [
      ...container.querySelectorAll<HTMLElement>('[data-testid=season-document-marker]'),
    ];
    try {
      await nextTick();
      expect(badges()).toHaveLength(0);
      enabled.value = true;
      await nextTick();
      expect(badges()).toHaveLength(getSeasonDocumentPoints(map.value, floor.value).length);
      expect(container.querySelector('.companion-season-document[tabindex]')).toBeNull();
      expect(container.querySelector('.companion-season-document[title]')).toBeNull();
      const shared = badges().find((element) => element.dataset.documentTypes!.includes(','))!;
      expect(shared.style.background).toContain('conic-gradient');
      let target!: L.Marker;
      owner.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.getElement()?.contains(shared)) target = layer;
      });
      target.fire('mouseover');
      expect(container.querySelector('[data-testid=season-document-details]')).toBeNull();
      target.fire('click', { latlng: target.getLatLng() });
      const details = container.querySelector('[data-testid=season-document-details]')!;
      expect(details.textContent).toContain('companion.season_document_types.project');
      expect(details.textContent).toContain('companion.season_document_types.blueprints');
      floor.value = 'Tunnels';
      await nextTick();
      expect(badges()).toHaveLength(getSeasonDocumentPoints(map.value, floor.value).length);
      expect(container.querySelector('[data-testid=season-document-details]')).toBeNull();
      enabled.value = false;
      await nextTick();
      expect(badges()).toHaveLength(0);
      expect(() => owner.setView([10, 15], 3, { animate: false })).not.toThrow();
      scope.stop();
    } finally {
      scope.stop();
      owner.remove();
      container.remove();
    }
  });
});
