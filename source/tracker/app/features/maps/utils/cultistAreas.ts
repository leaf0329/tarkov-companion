import definitions from '@/data/companionCultistAreas.json';
import { isPointOnSelectedFloor } from '@/features/maps/utils/mapPointDetails';
import { gameToLatLng } from '@/utils/mapCoordinates';
import type { MapPosition, TarkovMap } from '@/types/tarkov';
export interface CultistArea {
  id: string;
  mapId: string;
  location: string;
  floor?: string;
  outline?: Array<{ x: number; z: number }>;
  positions?: MapPosition[];
  source: string;
  sourceDate: string;
  anyScavSpawn?: boolean;
}
export interface CultistCircle {
  area: CultistArea;
  center: { x: number; z: number };
  radius: number;
  singlePoint: boolean;
}
const areas = definitions.areas as CultistArea[];
function floorPoints(area: CultistArea, map: TarkovMap, floor: string) {
  if (area.floor) return area.floor === floor ? (area.outline ?? []) : [];
  return (area.positions ?? []).filter((point) => isPointOnSelectedFloor(map, point, floor));
}
function circleForPoints(
  area: CultistArea,
  points: Array<{ x: number; z: number }>
): CultistCircle {
  const center = {
    x:
      (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) /
      2,
    z:
      (Math.min(...points.map((point) => point.z)) + Math.max(...points.map((point) => point.z))) /
      2,
  };
  const radius = Math.max(
    ...points.map((point) => Math.hypot(point.x - center.x, point.z - center.z))
  );
  return { area, center, radius: Math.max(15, radius), singlePoint: points.length === 1 };
}
export function getCultistCircles(map: TarkovMap, floor: string): CultistCircle[] {
  const mapIds = [map.id, ...(map.mergedIds ?? [])];
  return areas
    .filter((area) => mapIds.includes(area.mapId))
    .flatMap((area) => {
      const points = floorPoints(area, map, floor);
      return points.length ? [circleForPoints(area, points)] : [];
    });
}
export function cultistCircleOutline(circle: CultistCircle): Array<{ lat: number; lng: number }> {
  return Array.from({ length: 48 }, (_, index) => {
    const angle = (index * Math.PI) / 24;
    return gameToLatLng(
      circle.center.x + circle.radius * Math.cos(angle),
      circle.center.z + circle.radius * Math.sin(angle)
    );
  });
}
