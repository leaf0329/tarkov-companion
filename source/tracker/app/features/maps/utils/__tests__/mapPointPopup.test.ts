import L from 'leaflet';
import { describe, expect, it, vi } from 'vitest';
import { bindMapPointPopup } from '@/features/maps/utils/mapPointPopup';
describe('map point popup viewport', () => {
  it('resizes an open popup below a wrapping toolbar and stops listening when it closes', () => {
    const wrapper = document.createElement('div');
    wrapper.dataset.testid = 'map-surface';
    const toolbar = document.createElement('div');
    toolbar.dataset.testid = 'map-toolbar';
    const container = document.createElement('div');
    const canvasWrapper = document.createElement('div');
    canvasWrapper.appendChild(container);
    wrapper.append(toolbar, canvasWrapper);
    document.body.append(wrapper);
    let height = 480,
      toolbarBottom = 50;
    vi.spyOn(toolbar, 'getBoundingClientRect').mockImplementation(
      () => ({ bottom: toolbarBottom }) as DOMRect
    );
    const map = L.map(container, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
    }).setView([0, 0], 1);
    vi.spyOn(map, 'getSize').mockImplementation(() => L.point(380, height));
    const marker = L.marker([0, 0]).addTo(map);
    bindMapPointPopup(map, L, marker, () => document.createElement('section'));
    try {
      marker.openPopup();
      const popup = marker.getPopup()!;
      const fullSize = popup.options.maxHeight!;
      height = 180;
      toolbarBottom = 100;
      map.fire('resize');
      expect(popup.options.maxHeight).toBeLessThan(fullSize);
      expect(popup.options.maxHeight! + toolbarBottom).toBeLessThan(height);
      expect((popup.options.autoPanPaddingTopLeft as L.Point).y).toBeGreaterThan(toolbarBottom);
      marker.closePopup();
      const closedSize = popup.options.maxHeight;
      height = 600;
      map.fire('resize');
      expect(popup.options.maxHeight).toBe(closedSize);
    } finally {
      map.remove();
      wrapper.remove();
    }
  });
});
