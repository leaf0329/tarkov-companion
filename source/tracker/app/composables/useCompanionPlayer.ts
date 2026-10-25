import { gameToLatLng } from '@/utils/mapCoordinates';
import type { CompanionSnapshot } from '@/types/companion';
import type { TarkovMap } from '@/types/tarkov';
import type L from 'leaflet';
import type { ShallowRef } from 'vue';
export function useCompanionPlayer(
  map: Ref<TarkovMap>,
  instance: ShallowRef<L.Map | null>,
  leaflet: ShallowRef<typeof L | null>
): void {
  const state = useState<CompanionSnapshot | null>('companion');
  let marker: L.Marker | null = null;
  let owner: L.Map | null = null;
  let centered = false;
  const position = computed(() => state.value?.runtime.position);
  watch([position, instance, leaflet, () => state.value?.settings.follow], () => {
    const next = instance.value;
    const library = leaflet.value;
    const point = position.value;
    if (owner !== next) { marker?.remove(); marker = null; owner = next; centered = false; }
    if (!next || !library) return;
    if (!point || ![map.value.id, ...(map.value.mergedIds ?? [])].includes(point.map)) { marker?.remove(); marker = null; return; }
    const latLng = gameToLatLng(point.x, point.z);
    const svg = typeof map.value.svg === 'object' ? map.value.svg : undefined;
    const rotation = point.yaw - (svg?.coordinateRotation ?? map.value.tile?.coordinateRotation ?? 0);
    const icon = library.divIcon({ className: 'companion-player', iconSize: [24, 30], iconAnchor: [12, 15], html: `<svg width="24" height="30" viewBox="0 0 24 30" style="transform:rotate(${rotation}deg);filter:drop-shadow(0 1px 2px black)"><path d="M12 1 L17 28 L12 23 L7 28 Z" fill="#65ffd5" stroke="#083d31" stroke-width="1.4"/></svg>` });
    if (!marker) marker = library.marker(latLng, { icon, interactive: false, zIndexOffset: 1500 }).addTo(next);
    else {
      marker.setLatLng(latLng);
      const arrow = marker.getElement()?.querySelector('svg');
      if (arrow) arrow.style.transform = `rotate(${rotation}deg)`;
    }
    if (!state.value?.settings.follow) { centered = false; return; }
    const followMinimum = svg?.minZoom ?? map.value.tile?.minZoom ?? 1;
    if (!centered) next.setView(latLng, Math.max(next.getZoom(), followMinimum + 1.5), { animate: false });
    else next.panTo(latLng, { animate: false });
    centered = true;
  }, { flush: 'post' });
  onScopeDispose(() => marker?.remove());
}
