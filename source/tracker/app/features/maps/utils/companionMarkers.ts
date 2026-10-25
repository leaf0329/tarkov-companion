import { gameToLatLng, outlineToLatLngArray } from '@/utils/mapCoordinates';
import type { MapMark } from '@/features/maps/utils/marksHash';
import type { Task } from '@/types/tarkov';
import type L from 'leaflet';
function markPositions(mark: MapMark, mapId: string, library: typeof L): L.LatLngLiteral[] {
  const positions = (mark.possibleLocations ?? [])
    .filter((location) => location.map.id === mapId)
    .flatMap((location) => location.positions ?? [])
    .map((position) => gameToLatLng(position.x, position.z));
  const zones = mark.zones
    .filter((zone) => zone.map.id === mapId && zone.outline.length > 0)
    .map((zone) => library.latLngBounds(outlineToLatLngArray(zone.outline)).getCenter());
  return [...positions, ...zones];
}
function taskIcon(task: Task, library: typeof L): L.DivIcon {
  const container = document.createElement('div');
  container.className = 'flex w-32 -translate-x-1/2 flex-col items-center gap-1';
  const image = document.createElement('img');
  image.className = 'h-7 w-7 rounded-full border border-primary-400 shadow-lg';
  const url = task.trader?.imageLink;
  if (url?.startsWith('https://assets.tarkov.dev/')) image.src = url;
  image.alt = task.trader?.name ?? '';
  const label = document.createElement('span');
  label.className = 'max-w-32 rounded bg-black/80 px-1 text-center text-[10px] font-semibold text-primary-200';
  label.textContent = task.name ?? '';
  container.append(image, label);
  return library.divIcon({ className: 'companion-task-marker', html: container, iconSize: [1, 35], iconAnchor: [0, 14] });
}
export function renderCompanionMarkers({ marks, tasks, mapId, library, layer, attach }: {
  marks: MapMark[];
  tasks: Task[];
  mapId: string;
  library: typeof L;
  layer: L.LayerGroup;
  attach: (marker: L.Layer, objectiveId: string, location: () => L.LatLngExpression) => unknown;
}): void {
  const taskByObjective = new Map(tasks.flatMap((task) => (task.objectives ?? []).map((objective) => [objective.id, task] as const)));
  const shown = new Set<string>();
  for (const mark of marks) {
    const task = taskByObjective.get(mark.id ?? '');
    if (!task) continue;
    markPositions(mark, mapId, library).forEach((position) => {
      const key = `${mark.id}:${position.lat}:${position.lng}`;
      if (shown.has(key)) return;
      shown.add(key);
      const marker = library.marker(position, { icon: taskIcon(task, library) }).addTo(layer);
      attach(marker, mark.id!, () => marker.getLatLng());
    });
  }
}
