import definitions from '@/data/companionSeasonDocuments.json';
import { isPointOnSelectedFloor } from '@/features/maps/utils/mapPointDetails';
import type { MapPosition, TarkovMap } from '@/types/tarkov';
export interface SeasonDocumentType {
  id: string;
  key: string;
  color: string;
}
interface DocumentSpawn {
  id: string;
  position: MapPosition;
  documentIds: string[];
}
interface DocumentSource {
  label: string;
  url: string;
}
interface DocumentMap {
  mapIds: string[];
  spawns: DocumentSpawn[];
}
export interface SeasonDocumentPoint extends DocumentSpawn {
  documents: SeasonDocumentType[];
  source: DocumentSource;
}
export const seasonDocumentTypes = definitions.types as SeasonDocumentType[];
const maps = definitions.maps as DocumentMap[];
const source = definitions.source as DocumentSource;
const typesById = new Map(seasonDocumentTypes.map((document) => [document.id, document]));
function mapDocuments(map: TarkovMap): DocumentMap[] {
  const ids = [map.id, ...(map.mergedIds ?? [])];
  return maps.filter((entry) => entry.mapIds.some((id) => ids.includes(id)));
}
export function getMapSeasonDocumentTypes(map: TarkovMap): SeasonDocumentType[] {
  const ids = new Set(
    mapDocuments(map).flatMap((entry) => entry.spawns.flatMap((spawn) => spawn.documentIds))
  );
  return seasonDocumentTypes.filter((document) => ids.has(document.id));
}
export function getSeasonDocumentPoints(map: TarkovMap, floor: string): SeasonDocumentPoint[] {
  return mapDocuments(map).flatMap((entry) =>
    entry.spawns
      .filter((spawn) => isPointOnSelectedFloor(map, spawn.position, floor))
      .map((spawn) => ({
        ...spawn,
        documents: spawn.documentIds.map((id) => typesById.get(id)!),
        source,
      }))
  );
}
