const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ main, overlay, store, root, dataDir, publish, wait, until, checks }) => {
  const id = '675c15fbf7da9792a4059871';
  const quest = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-core.json'))).data.tasks.find(task => task.id === id);
  const goals = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-objectives.json'))).data.tasks.find(task => task.id === id).objectives;
  const saveUI = store.saveUI.bind(store);
  store.saveUI = value => {
    fs.appendFileSync(path.join(dataDir, 'progress-writes.jsonl'), JSON.stringify({ at: Date.now(), objective: value.state.pve?.taskObjectives?.[goals[0].id] ?? null }) + '\n');
    return saveUI(value);
  };
  store.event({ kind: 'quest', id, profile: store.disk.selectedProfile, status: 'active', at: Date.now(), history: false });
  publish();
  const markers = `Array.from(document.querySelectorAll('.companion-task-marker')).filter(marker=>marker.textContent.trim()===${JSON.stringify(quest.name)})`;
  const count = win => win.webContents.executeJavaScript(`${markers}.length`);
  for (const win of [main, overlay]) await until(async () => await count(win) === goals.length);
  checks.push('main map and mini map show all four camera placements and the combat zone simultaneously');
  const js = code => overlay.webContents.executeJavaScript(code);
  main.hide(); overlay.showInactive();
  await js(`${markers}[0].click()`);
  await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===1"));
  assert.equal(await js("document.querySelector('[data-testid=task-objective-row]').dataset.objectiveId"), goals[0].id);
  await js("document.querySelector('[data-testid=task-objectives-expand]').click()");
  await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===5"));
  const removed = await js(`(()=>{const first=${markers}[0];return {position:first.style.transform,others:${markers}.slice(1).map(marker=>marker.style.transform)}})()`);
  const clickState = await js(`(()=>{const button=document.querySelector('[data-objective-id="${goals[0].id}"] [data-testid=task-objective-toggle]');const before={disabled:button.disabled,complete:button.getAttribute('aria-pressed')};button.click();return before})()`);
  assert.equal(clickState.disabled, false);
  await wait(1000);
  fs.writeFileSync(path.join(dataDir, 'completion-state.json'), JSON.stringify(await Promise.all([main, overlay].map(async win => ({
    count: await count(win),
    ui: await win.webContents.executeJavaScript("({markers:Array.from(document.querySelectorAll('.companion-task-marker'),marker=>({text:marker.textContent,position:marker.style.transform})),rows:Array.from(document.querySelectorAll('[data-testid=task-objective-row]'),row=>({id:row.dataset.objectiveId,complete:row.querySelector('[data-testid=task-objective-toggle]')?.getAttribute('aria-pressed')}))})"),
  }))), null, 2));
  for (const win of [main, overlay]) await until(async () => await count(win) === goals.length - 1);
  const remaining = await js(`${markers}.map(marker=>marker.style.transform)`);
  assert.deepEqual(remaining, removed.others);
  checks.push('checking off one camera removes only its own marker and synchronizes the remaining points to both windows');
  await until(() => store.profile().ui.pve?.taskObjectives[goals[0].id]?.complete === true);
  overlay.reload();
  await until(async () => await count(overlay) === goals.length - 1);
  checks.push('the objective completion persists after the mini map reloads');
  await js(`${markers}[0].click()`);
  await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===1"));
  await js("document.querySelector('[data-testid=task-objectives-expand]').click()");
  await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===5"));
  const rows = await js("Array.from(document.querySelectorAll('[data-testid=task-objective-row]'),row=>({id:row.dataset.objectiveId,complete:row.querySelector('[data-testid=task-objective-toggle]')?.getAttribute('aria-pressed')}))");
  assert.equal(rows.find(row => row.id === goals[0].id).complete, 'true');
  checks.push('each marker opens its own goal and can expand the full task, including completed goals');
  await js("document.querySelector('[data-testid=objective-close-button]').click()");
  const saved = overlay.getBounds();
  for (const size of [[480, 400], [380, 320], [100, 100], [620, 570]]) {
    overlay.setSize(...size); await wait(550);
    assert.ok(overlay.getSize()[0] >= 380 && overlay.getSize()[1] >= 320);
    assert.equal(await count(overlay), goals.length - 1);
    await js("document.querySelector('[data-testid=companion-follow-toggle]').click()");
    await wait(150);
    assert.equal(overlay.isFocused(), false);
  }
  overlay.setBounds(saved); await wait(600);
  await js("document.querySelector('[data-testid=map-reset-view]').click()");
  await wait(500);
  const visible = await js(`(()=>{const map=document.querySelector('.leaflet-container').getBoundingClientRect();return ${markers}.every(marker=>{const r=marker.getBoundingClientRect();return r.right>=map.left&&r.left<=map.right&&r.bottom>=map.top&&r.top<=map.bottom})})()`);
  assert.equal(visible, true, 'remaining task points stay visible in the full-map view after resizing');
  fs.writeFileSync(path.join(dataDir, 'multi-objective-overlay.png'), (await overlay.webContents.capturePage()).toPNG());
  checks.push('minimum-size map stays responsive, enforces window limits and retains all remaining task markers');
  const bunkerId = '5ede55112c95834b583f052a';
  const bunker = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-core.json'))).data.tasks.find(task => task.id === bunkerId);
  const bunkerGoals = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-objectives.json'))).data.tasks.find(task => task.id === bunkerId).objectives;
  store.event({ kind: 'quest', id: bunkerId, profile: store.disk.selectedProfile, status: 'active', at: Date.now(), history: false });
  store.event({ kind: 'map', map: bunker.map.id, mode: 'pve', history: false });
  publish();
  const bunkerMarkers = `Array.from(document.querySelectorAll('.companion-task-marker')).filter(marker=>marker.textContent.trim()===${JSON.stringify(bunker.name)})`;
  for (const win of [main, overlay]) {
    const evaluate = code => win.webContents.executeJavaScript(code);
    await until(async () => await evaluate(`${bunkerMarkers}.length`) === bunkerGoals.length);
    const selectedIds = [];
    for (let index = 0; index < bunkerGoals.length; index++) {
      await evaluate(`${bunkerMarkers}[${index}].click()`);
      await until(() => evaluate("document.querySelectorAll('[data-testid=task-objective-row]').length===1"));
      const row = await evaluate("(()=>{const row=document.querySelector('[data-testid=task-objective-row]');return {id:row.dataset.objectiveId,text:row.textContent,current:row.dataset.currentObjective,label:document.querySelector('[data-testid=current-point-label]').textContent,expand:document.querySelector('[data-testid=task-objectives-expand]').textContent}})()");
      assert.equal(row.id, bunkerGoals[index].id);
      assert.ok(row.text.includes(bunkerGoals[index].description));
      assert.equal(row.current, 'true');
      assert.equal(row.label, '当前点位');
      assert.ok(row.expand.includes('展开完整任务'));
      selectedIds.push(row.id);
      await evaluate("document.querySelector('[data-testid=objective-close-button]').click()");
    }
    assert.equal(new Set(selectedIds).size, bunkerGoals.length);
  }
  checks.push('all seven actual Bunker markers open distinct named branches in both windows');
  const branch = bunkerGoals.findIndex(goal => goal.description.includes('白主教'));
  await js(`${bunkerMarkers}[${branch}].click()`);
  await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===1"));
  fs.writeFileSync(path.join(dataDir, 'bunker-point-overlay.png'), (await overlay.webContents.capturePage()).toPNG());
  await js("document.querySelector('[data-testid=task-objectives-expand]').click()");
  await until(async () => await js("document.querySelectorAll('[data-testid=task-objective-row]').length") === bunkerGoals.length);
  assert.equal(await js("document.querySelector('[data-current-objective=true]').dataset.objectiveId"), bunkerGoals[branch].id);
  await js("document.querySelector('[data-testid=task-objectives-expand]').click()");
  await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===1"));
  await js("document.querySelector('[data-testid=task-objective-toggle]').click()");
  for (const win of [main, overlay]) await until(async () => await win.webContents.executeJavaScript(`${bunkerMarkers}.length`) === bunkerGoals.length - 1);
  assert.equal(store.profile().ui.pve.taskObjectives[bunkerGoals[branch].id].complete, true);
  assert.equal(bunkerGoals.filter(goal => store.profile().ui.pve.taskObjectives[goal.id]?.complete).length, 1);
  checks.push('expanding and collapsing retains the selected Bunker branch; its checkbox removes only that branch in both windows');
};
