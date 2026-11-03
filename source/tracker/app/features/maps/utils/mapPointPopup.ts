import type L from 'leaflet';
function toolbarInset(map: L.Map): number {
  const container = map.getContainer();
  const toolbar = container
    .closest('[data-testid=map-surface]')
    ?.querySelector('[data-testid=map-toolbar]');
  if (!toolbar) return 8;
  return Math.max(
    8,
    toolbar.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 8
  );
}
function rightControlsInset(map: L.Map): number {
  const container = map.getContainer();
  const zoomControl = container
    .closest('[data-testid=map-surface]')
    ?.querySelector('[data-testid=map-zoom-in]');
  if (!zoomControl) return 8;
  // These controls sit outside Leaflet's panes and can cover the popup close button.
  return Math.max(
    8,
    container.getBoundingClientRect().right - zoomControl.getBoundingClientRect().left + 8
  );
}
export function bindMapPointPopup(
  map: L.Map,
  library: typeof L,
  layer: L.Layer,
  content: () => HTMLElement
): void {
  const pane = map.getPane('mapPointDetails') ?? map.createPane('mapPointDetails');
  pane.style.zIndex = '1100';
  layer.bindPopup(content, { pane: 'mapPointDetails', maxWidth: 280 });
  const popup = layer.getPopup()!;
  const resize = () => {
    const top = toolbarInset(map);
    // Keep the close control outside the scroll area and clear of a wrapping toolbar.
    popup.options.maxHeight = Math.max(40, map.getSize().y - top - 48);
    popup.options.autoPanPaddingTopLeft = library.point(8, top);
    popup.options.autoPanPaddingBottomRight = library.point(rightControlsInset(map), 8);
    popup.update();
  };
  layer.on('popupopen', () => {
    map.on('resize', resize);
    resize();
  });
  layer.on('popupclose', () => map.off('resize', resize));
}
