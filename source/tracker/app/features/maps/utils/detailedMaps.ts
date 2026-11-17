import definitions from '@/data/companionDetailedMaps.json';
import type { MapTileConfig, TarkovMap } from '@/types/tarkov';
export interface DetailedMapDefinition {
  mapId: string;
  key: string;
  floors: string[];
  maxNativeZoom: number;
}
export interface ReferenceMapDefinition {
  mapId: string;
  key: string;
  credit: string;
  width: number;
  height: number;
}
const detailedMaps = definitions.maps as DetailedMapDefinition[];
export function detailedMapFor(map: TarkovMap): DetailedMapDefinition | undefined {
  return detailedMaps.find((entry) => entry.mapId === map.id);
}
export function referenceMapFor(map: TarkovMap): ReferenceMapDefinition | undefined {
  return (definitions.referenceImages as ReferenceMapDefinition[]).find(
    (entry) => entry.mapId === map.id
  );
}
export function withDetailedMap(map: TarkovMap, floor: string, enabled: boolean): TarkovMap {
  const detailed = enabled ? detailedMapFor(map) : undefined;
  if (!detailed?.floors.includes(floor)) return map;
  const base = typeof map.svg === 'object' ? map.svg : map.tile!;
  const tile: MapTileConfig = {
    coordinateRotation: base.coordinateRotation,
    transform: base.transform,
    bounds: base.bounds,
    floors: base.floors,
    defaultFloor: base.defaultFloor,
    minZoom: 0,
    maxZoom: base.maxZoom ?? 6,
    maxNativeZoom: detailed.maxNativeZoom,
    tileSize: 256,
    tilePath:
      '/companion/terrain/' +
      detailed.key +
      (floor ? '/' + encodeURIComponent(floor) : '') +
      '/{z}/{x}/y{y}.webp',
  };
  return { ...map, tile };
}
