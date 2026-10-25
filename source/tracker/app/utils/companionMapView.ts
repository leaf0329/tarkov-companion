import type L from 'leaflet';
export const OVERVIEW_PADDING: [number, number] = [12, 12];
export function updateOverviewMinZoom(
  instance: L.Map,
  bounds: L.LatLngBoundsExpression,
  configuredMinimum: number,
  totalPadding: [number, number] = [24, 24]
): number {
  const size = instance.getSize();
  if (size.x <= totalPadding[0] || size.y <= totalPadding[1]) return instance.getMinZoom();
  const previousMinimum = instance.options.minZoom;
  const padding = size.clone();
  padding.x = totalPadding[0];
  padding.y = totalPadding[1];
  let fitZoom: number;
  // getBoundsZoom clamps its result to minZoom; remove that limit during the calculation.
  instance.options.minZoom = -Infinity;
  try {
    fitZoom = instance.getBoundsZoom(bounds, false, padding);
  } finally {
    instance.options.minZoom = previousMinimum;
  }
  if (!Number.isFinite(fitZoom)) return instance.getMinZoom();
  const minimum = Math.min(configuredMinimum, fitZoom - 0.5);
  instance.setMinZoom(minimum);
  return minimum;
}
