import fs from 'node:fs';
import path from 'node:path';
const folder = path.resolve('data/acceptance/overlay-fixes-20261020');
if (fs.existsSync(folder)) throw Error('The overlay fixture already exists: ' + folder);
const logs = path.join(folder, 'Logs'), shots = path.join(folder, 'Screenshots');
const session = path.join(logs, 'log_2026.10.20_12-00-00_1.2.5.0');
fs.mkdirSync(session, { recursive: true });
fs.mkdirSync(shots);
const at = Date.now() - 10000;
const scene = JSON.parse(fs.readFileSync('data/maps.json')).data.maps['56f40101d2720b2a4d8b45d6'].scenePath;
const line = (offset, text) => new Date(at + offset).toISOString().replace('T', ' ').replace('Z', ' +00:00') + '|1.2.5.0.48146|Info|application|' + text + '\n';
fs.writeFileSync(path.join(session, 'application_000.log'), line(0, 'Session mode: Pve') + line(10, 'PrepareSelectedProfileLocally ProfileId:aaaaaaaaaaaaaaaaaaaaaaaa AccountId:123') + line(20, 'scene preset path:' + scene));
fs.writeFileSync(path.join(folder, 'companion.json'), JSON.stringify({
  settings: { logsPath: logs, screenshotsPath: shots, hotkey: 'F10', opacity: 100, interval: 5, autoScreenshot: false, cleanupScreenshots: false, follow: false },
  selectedProfile: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  profiles: { aaaaaaaaaaaaaaaaaaaaaaaa: { tasks: {}, objectives: {}, ui: {} } },
}, null, 2));
