import extractRules from '@/data/companionExtractRequirements.json';
import floorData from '@/data/companionLandmarks.json';
import { isCoopExtract } from '@/features/maps/composables/useLeafletMapControls';
import type { MapExtract, MapLock, MapPosition, TarkovMap } from '@/types/tarkov';
interface FloorExtent {
  height: number[];
  bounds?: Array<[number[], number[], string?]>;
}
interface FloorDefinition {
  regions: Record<string, FloorExtent[]>;
}
export type PointTranslate = (key: string, values?: Record<string, string | number>) => string;
export type ItemNameLookup = (id: string) => string | undefined;
const definitions = floorData as unknown as Record<string, FloorDefinition>;
const rules = extractRules.extracts as Record<string, string[]>;
const floorToken = (floor?: string) => (floor ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const floorNames: Record<string, string> = {
  groundlevel: 'ground',
  groundfloor: 'ground',
  firstlevel: 'first',
  '2ndfloor': 'second',
  secondlevel: 'second',
  '3rdfloor': 'third',
  '4thfloor': 'fourth',
  '5thfloor': 'fifth',
  bunkers: 'bunkers',
  underground: 'underground',
  tunnels: 'tunnels',
  technical: 'technical',
  garage: 'garage',
};
function getMapConfig(map: TarkovMap) {
  return typeof map.svg === 'object' ? map.svg : map.tile;
}
function getDefinition(map: TarkovMap): FloorDefinition | undefined {
  const asset = typeof map.svg === 'object' ? map.svg.file : map.tile?.tilePath;
  return asset ? definitions[asset] : undefined;
}
function inHeight(y: number, range: number[]): boolean {
  return y >= range[0]! && y < range[1]!;
}
function inRectangle(point: MapPosition, bounds: [number[], number[], string?]): boolean {
  const [a, b] = bounds;
  const axes: Array<[number, number, number]> = [
    [point.x, a[0]!, b[0]!],
    [point.z, a[1]!, b[1]!],
  ];
  return axes.every(
    ([value, start, end]) => value >= Math.min(start, end) && value <= Math.max(start, end)
  );
}
function inExtent(point: MapPosition, extent: FloorExtent): boolean {
  if (!inHeight(point.y, extent.height)) return false;
  return !extent.bounds?.length || extent.bounds.some((bounds) => inRectangle(point, bounds));
}
export function getPointFloor(map: TarkovMap, point: MapPosition): string | undefined {
  const config = getMapConfig(map);
  const definition = getDefinition(map);
  if (!config || !definition) return undefined;
  // Upper floors overlap the broad ground range, and some buildings have their own height bands.
  const region = Object.entries(definition.regions)
    .reverse()
    .find(([, extents]) => extents.some((extent) => inExtent(point, extent)));
  if (region) return region[0];
  // Outdoor terrain can be higher than an indoor floor's range without belonging to that floor.
  return config.defaultFloor;
}
export function isPointOnSelectedFloor(
  map: TarkovMap,
  point: MapPosition,
  selected: string
): boolean {
  const config = getMapConfig(map);
  if (!config) return false;
  const actual = getPointFloor(map, point);
  const visibleFloor = config.floors?.find((floor) => floorToken(floor) === floorToken(actual));
  // Some SVGs combine every above-ground building floor into a single base layer.
  return floorToken(visibleFloor ?? config.defaultFloor) === floorToken(selected);
}
export function getPointFloorLabel(
  map: TarkovMap,
  point: MapPosition | undefined,
  t: PointTranslate
): string {
  const floor = point ? getPointFloor(map, point) : undefined;
  if (!floor) return t('companion.floor_unknown');
  const name = floorNames[floorToken(floor)];
  return name ? t(`companion.floor_names.${name}`) : floor.replace(/_/g, ' ');
}
function getActivationConditions(map: TarkovMap, extract: MapExtract, t: PointTranslate): string[] {
  return (extract.switches ?? []).map((id) => {
    const name =
      map.switches?.find((sw) => sw.id === id)?.name ?? t('companion.activation_unknown');
    return t('companion.activation_required', { name });
  });
}
function getTransferConditions(
  extract: MapExtract,
  itemName: ItemNameLookup,
  t: PointTranslate
): string[] {
  const required = extract.transferItem;
  if (!required) return [];
  const name = itemName(required.item) ?? t('companion.item_unknown');
  return [t('companion.extract_item_required', { name, count: required.count })];
}
export function getExtractConditions(
  map: TarkovMap,
  extract: MapExtract,
  itemName: ItemNameLookup,
  t: PointTranslate
): string[] {
  const conditions = (rules[extract.id] ?? []).map((rule) => t(`companion.extract_rules.${rule}`));
  conditions.push(
    ...getActivationConditions(map, extract, t),
    ...getTransferConditions(extract, itemName, t)
  );
  if (isCoopExtract(extract)) conditions.push(t('companion.extract_rules.coop'));
  return conditions.length ? [...new Set(conditions)] : [t('companion.extract_conditions_unknown')];
}
function row(parent: HTMLElement, label: string, value: string): void {
  const element = document.createElement('p');
  element.className = 'm-0! mb-2! text-xs! leading-relaxed';
  element.textContent = label ? label + '：' + value : value;
  parent.appendChild(element);
}
function content(title: string): HTMLElement {
  const element = document.createElement('section');
  element.className = 'min-w-44 text-surface-100!';
  const heading = document.createElement('strong');
  heading.className = 'mb-3 block pr-4 text-sm';
  heading.textContent = title;
  element.appendChild(heading);
  return element;
}
export function createExtractDetails(
  map: TarkovMap,
  extract: MapExtract,
  name: string,
  itemName: ItemNameLookup,
  t: PointTranslate
): HTMLElement {
  const element = content(name);
  element.dataset.testid = 'extract-details';
  element.dataset.extractId = extract.id;
  row(
    element,
    t('companion.extract_faction'),
    t(`companion.extract_factions.${extract.faction ?? 'unknown'}`)
  );
  row(element, t('companion.point_floor'), getPointFloorLabel(map, extract.position, t));
  const heading = document.createElement('strong');
  heading.className = 'mb-1 block text-xs';
  heading.textContent = t('companion.extract_conditions');
  element.appendChild(heading);
  const list = document.createElement('ul');
  list.className = 'm-0! space-y-1 pl-4 text-xs';
  for (const condition of getExtractConditions(map, extract, itemName, t)) {
    const item = document.createElement('li');
    item.textContent = condition;
    list.appendChild(item);
  }
  element.appendChild(list);
  row(element, '', t('companion.extract_availability'));
  return element;
}
export function createKeyRoomDetails(
  map: TarkovMap,
  lock: MapLock,
  itemName: ItemNameLookup,
  t: PointTranslate
): HTMLElement {
  const name = itemName(lock.key) ?? t('companion.key_unknown');
  const element = content(t('companion.key_rooms'));
  element.dataset.testid = 'key-room-details';
  element.dataset.lockId = lock.id;
  row(element, t('companion.required_key'), name);
  row(element, t('companion.point_floor'), getPointFloorLabel(map, lock.position, t));
  if (lock.needsPower) row(element, t('companion.activation_label'), t('companion.power_required'));
  return element;
}
