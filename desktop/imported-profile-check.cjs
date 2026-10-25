const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ main, overlay, store, root, publish, until }) => {
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'data/task-sync-result-20261017.json'))).tasks;
  const names = expected.map(task => task.name).sort();
  const before = structuredClone(store.disk);
  const js = code => main.webContents.executeJavaScript(code);
  await until(() => js("document.querySelectorAll('aside a strong').length===60"));
  const shown = await js("Array.from(document.querySelectorAll('aside a strong')).map(el=>el.textContent.trim()).sort()");
  assert.deepEqual(shown, names);
  await until(() => overlay.webContents.executeJavaScript("!!window.companion && !!document.querySelector('.leaflet-container')"));
  const progress = await overlay.webContents.executeJavaScript('window.companion.getState()');
  const active = Object.entries(progress.progress).filter(([, value]) => ['active', 'ready'].includes(value.status)).map(([id]) => id).sort();
  assert.deepEqual(active, expected.map(task => task.id).sort());
  const maps = [
    { id: '55f2d3fd4bdc2d5f408b4567', name: 'Hidden Route' },
    { id: '5704e4dad2720bb55b8b4567', name: '战争迷雾' },
  ];
  for (const map of maps) {
    store.runtime.map = map.id;
    publish();
    const expression = `Array.from(document.querySelectorAll('.companion-task-marker')).some(el=>el.textContent.includes(${JSON.stringify(map.name)}))`;
    await until(() => js(expression));
    await until(() => overlay.webContents.executeJavaScript(expression));
  }
  assert.deepEqual(store.profile().ui.pve.taskObjectives, before.profiles[before.selectedProfile].ui.pve.taskObjectives);
  assert.deepEqual(store.profile().ui.pve.hideoutModules, before.profiles[before.selectedProfile].ui.pve.hideoutModules);
  return { ok: true, activeTaskNames: shown.length, mainAndOverlaySupplementMarkers: maps.map(map => map.name), objectiveRecordsPreserved: true, hideoutLevelsPreserved: true, at: new Date().toISOString() };
};
