import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'source/maps/src/data/maps.json')));
const events = JSON.parse(fs.readFileSync(path.join(root, 'source/maps/src/data/companion-event-maps.json')));
const definitions = JSON.parse(fs.readFileSync(path.join(root, 'source/tracker/app/data/maps.json')));
const translations = JSON.parse(fs.readFileSync(path.join(root, 'source/tracker/app/data/companionLandmarkNames.json')));
const aliases = { 'ground-zero': 'groundzero', 'streets-of-tarkov': 'streetsoftarkov', 'the-lab': 'lab', 'infected-factory': 'infectedfactory', 'infected-lab': 'infectedlab' };
const token = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const output = {};
for (const map of [...source, ...events.maps]) {
  const layer = map.maps.find(candidate => candidate.projection === 'interactive');
  if (!layer) continue;
  const definition = definitions[aliases[map.normalizedName] ?? map.normalizedName];
  const config = definition?.svg ?? definition?.tile;
  if (!config) continue;
  const overlays = layer.layers ?? [];
  const upperFloors = overlays.map(floor => floor.extents[0].height);
  const baseRange = layer.heightRange ?? [-10000, Math.min(10000, ...upperFloors.map(range => range[0]))];
  const floors = { [token(config.defaultFloor)]: baseRange };
  for (const floor of overlays) floors[token(floor.name)] = floor.extents[0].height;
  const labels = (layer.labels ?? []).map(label => ({ ...label, top: label.top ?? 10000, bottom: label.bottom ?? -10000, name: translations[label.text] ?? label.text }));
  const regions = Object.fromEntries(overlays.map(floor => [floor.name, floor.extents]));
  output[config.file ?? config.tilePath] = { floors, regions, labels };
}
const destination = path.join(root, 'source/tracker/app/data/companionLandmarks.json');
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log(`Synced ${Object.keys(output).length} maps and ${Object.values(output).reduce((sum, map) => sum + map.labels.length, 0)} place names`);
