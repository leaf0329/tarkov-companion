import placeNames from '@/data/companionLandmarks.json';
import { gameToLatLng } from '@/utils/mapCoordinates';
import type { TarkovMap } from '@/types/tarkov';
import type L from 'leaflet';
interface PlaceName {
  position: number[];
  text: string;
  name: string;
  size?: number;
  top: number;
  bottom: number;
}
interface PlaceMap {
  floors: Record<string, number[]>;
  labels: PlaceName[];
}
const definitions = placeNames as Record<string, PlaceMap>;
const floorToken = (floor: string) => floor.toLowerCase().replace(/[^a-z0-9]/g, '');
export function isPlaceNameVisible(label: PlaceName, range: number[] | undefined, zoom: number, minimumZoom: number): boolean {
  if ((label.size ?? 100) < 90 && zoom < minimumZoom + 1) return false;
  return isPlaceOnFloor(label, range);
}
function isPlaceOnFloor(label: PlaceName, range: number[] | undefined): boolean {
  if (!range) return false;
  return label.bottom < range[1]! && label.top >= range[0]!;
}
function placeElement(label: PlaceName): HTMLElement {
  const element = document.createElement('div');
  element.className = 'pointer-events-none w-max max-w-36 -translate-x-1/2 -translate-y-1/2 text-center font-semibold leading-tight text-amber-100';
  element.style.fontSize = '11px';
  element.style.textShadow = '0 1px 2px #000,0 -1px 2px #000,1px 0 2px #000,-1px 0 2px #000';
  element.textContent = label.name;
  if (label.name !== label.text) {
    const original = document.createElement('span');
    original.className = 'block text-[9px] font-normal text-surface-200';
    original.textContent = label.text;
    element.appendChild(original);
  }
  return element;
}
export function useCompanionPlaceNames(map: Ref<TarkovMap>, instance: Ref<L.Map | null>, library: Ref<typeof L | null>, floor: Ref<string>): void {
  if (!(import.meta.client && window.companion)) return;
  const asset = computed(() => {
    if (typeof map.value.svg === 'object') return map.value.svg.file;
    return map.value.tile?.tilePath ?? '';
  });
  const definition = computed(() => definitions[asset.value]);
  let owner: L.Map | null = null;
  let group: L.LayerGroup | null = null;
  let markers: Array<{ marker: L.Marker; label: PlaceName }> = [];
  const updateMarker = (entry: { marker: L.Marker; label: PlaceName }, range: number[] | undefined, zoom: number, minimumZoom: number) => {
    const element = entry.marker.getElement();
    if (element) element.style.display = isPlaceNameVisible(entry.label, range, zoom, minimumZoom) ? '' : 'none';
  };
  const update = () => {
    if (!owner) return;
    const range = definition.value?.floors[floorToken(floor.value)];
    const zoom = owner.getZoom(), minimumZoom = owner.getMinZoom();
    for (const entry of markers) updateMarker(entry, range, zoom, minimumZoom);
  };
  const clear = () => {
    owner?.off('zoomend resize', update);
    group?.remove();
    owner = null;
    group = null;
    markers = [];
  };
  const context = () => {
    if (!instance.value || !library.value || !definition.value) return null;
    return { map: instance.value, L: library.value, data: definition.value };
  };
  watch([instance, library, definition], () => {
    clear();
    const next = context();
    if (!next) return;
    owner = next.map;
    const pane = owner.getPane('companionPlaceNames') ?? owner.createPane('companionPlaceNames');
    pane.style.zIndex = '350';
    pane.style.pointerEvents = 'none';
    group = next.L.layerGroup().addTo(owner);
    markers = next.data.labels.map(label => {
      const icon = next.L.divIcon({ className: 'companion-place-label pointer-events-none', html: placeElement(label), iconSize: [0, 0], iconAnchor: [0, 0] });
      const marker = next.L.marker(gameToLatLng(label.position[0]!, label.position[1]!), { icon, interactive: false, keyboard: false, pane: 'companionPlaceNames' }).addTo(group!);
      return { marker, label };
    });
    owner.on('zoomend resize', update);
    update();
  }, { immediate: true, flush: 'post' });
  watch(floor, update);
  onScopeDispose(clear);
}
