const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ipcMain } = require('electron');

module.exports = async ({ main, overlay, store, root, dataDir, origin, publish, wait, until, checks }) => {
  const js = code => overlay.webContents.executeJavaScript(code);
  const core = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-core.json'))).data;
  const task = '5b4795fb86f7745876267770';
  const taskName = core.tasks.find(t => t.id === task).name;
  const hasMarker = name => js(`Array.from(document.querySelectorAll('.companion-task-marker')).some(m=>m.textContent.trim()===${JSON.stringify(name)})`);
  const event = (id, status) => store.event({ kind: 'quest', id, profile: store.disk.selectedProfile, status, at: Date.now(), history: false });
  const debug = overlay.webContents.debugger;
  const click = async selector => {
    const point = await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing overlay control');const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
    await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
    await wait(100);
  };
  const secure = sender => { if (!sender.getURL().startsWith(origin + '/')) throw Error('Invalid test window'); };
  let stateReads = 0, delayedInitial = false;
  ipcMain.removeHandler('companion:state');
  ipcMain.handle('companion:state', async e => {
    secure(e.sender);
    if (e.sender.id === overlay.webContents.id) {
      stateReads++;
      if (delayedInitial) {
        delayedInitial = false;
        const older = structuredClone(store.snapshot());
        event(task, 'active');
        overlay.webContents.send('companion:state-update', store.snapshot());
        await wait(250);
        return older;
      }
    }
    return store.snapshot();
  });
  main.hide(); overlay.showInactive();
  debug.attach('1.3');
  try {
    const layout = await js(`(()=>{const bar=document.querySelector('[data-testid=companion-toolbar]'),handle=document.querySelector('[data-testid=companion-drag-handle]'),drag=handle.getBoundingClientRect();const buttons=Array.from(bar.querySelectorAll('button')).map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,overlapsDrag:r.left<drag.right&&r.right>drag.left&&r.top<drag.bottom&&r.bottom>drag.top}});return {barRegion:getComputedStyle(bar).webkitAppRegion,handleRegion:getComputedStyle(handle).webkitAppRegion,buttons}})()`);
    assert.equal(layout.barRegion, 'no-drag');
    assert.equal(layout.handleRegion, 'drag');
    assert.ok(layout.buttons.every(button => !button.overlapsDrag));
    await js("window.__overlayTrustedClicks=0;document.addEventListener('pointerdown',e=>{if(e.isTrusted&&e.target.closest('[data-testid=companion-capture-toggle], [data-testid=companion-follow-toggle]'))window.__overlayTrustedClicks++},true)");
    for (const [key, selector, label] of [
      ['autoScreenshot', '[data-testid=companion-capture-toggle]', '自动截图'],
      ['follow', '[data-testid=companion-follow-toggle]', '跟随'],
    ]) {
      const original = store.disk.settings[key];
      await click(selector);
      await until(() => store.disk.settings[key] !== original);
      const expected = key === 'autoScreenshot'
        ? (store.disk.settings[key] ? store.disk.settings.interval + 's' : '关')
        : (store.disk.settings[key] ? '开' : '关');
      await until(() => js(`document.querySelector(${JSON.stringify(selector)}).textContent.includes(${JSON.stringify(expected)})`));
      await until(() => main.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes(${JSON.stringify(label)})&&b.textContent.includes(${JSON.stringify(expected)}))`));
      assert.equal(JSON.parse(fs.readFileSync(store.file)).settings[key], !original);
      await click(selector);
      await until(() => store.disk.settings[key] === original);
    }
    assert.equal(await js('window.__overlayTrustedClicks'), 4);
    assert.equal(overlay.isFocused(), false);
    assert.equal(overlay.isFocusable(), false);
    checks.push('trusted mouse clicks toggle capture and Follow in the overlay, persist them and synchronize the main window without overlapping a drag region');

    await click('[data-testid=companion-fullscreen-toggle]');
    await until(() => overlay.isFullScreen());
    await wait(300);
    await click('[data-testid=companion-fullscreen-toggle]');
    await until(() => !overlay.isFullScreen());
    checks.push('the overlay fullscreen button enters and exits fullscreen with trusted mouse clicks');

    event(task, 'completed'); publish();
    await until(async () => !await hasMarker(taskName));
    await wait(600);
    delayedInitial = true;
    overlay.reload();
    await until(() => hasMarker(taskName));
    assert.ok(stateReads > 0);
    checks.push('a task message received during overlay initialization survives a delayed older initial reply');

    const readsBeforeGap = stateReads;
    event(task, 'completed');
    overlay.webContents.send('companion:state-update', store.snapshot(false));
    await wait(400);
    assert.ok(stateReads > readsBeforeGap, 'a missed task update must trigger a complete state request');
    await until(async () => !await hasMarker(taskName));
    checks.push('the overlay detects a missed progress revision, requests a full snapshot and removes a completed task marker');

    overlay.hide(); event(task, 'active'); publish(); await wait(100);
    overlay.showInactive(); await until(() => hasMarker(taskName));
    checks.push('task markers synchronize when the overlay is reopened with the main window hidden');

    const groundTask = '657315ddab5a49b71f098853';
    const groundName = core.tasks.find(t => t.id === groundTask).name;
    const goals = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-objectives.json'))).data.tasks.find(t => t.id === groundTask).objectives;
    for (const goal of goals) delete store.profile().ui.pve.taskObjectives[goal.id];
    event(groundTask, 'active');
    store.runtime.map = '65b8d6f5cdde2479cb2a3125'; publish();
    await until(() => js("document.querySelector('[data-testid=companion-map-select]').dataset.value==='653e6760052c01c1c805532f'"));
    await until(() => hasMarker(groundName));
    checks.push('official Ground Zero 21+ coordinates use the shared base map without losing its active task markers');
    await click('[data-testid=map-reset-view]');
    await wait(300);
    fs.writeFileSync(path.join(dataDir, 'overlay-synced-tasks.png'), (await overlay.webContents.capturePage()).toPNG());
    store.runtime.map = '56f40101d2720b2a4d8b45d6'; publish();
    await until(() => js("document.querySelector('[data-testid=companion-map-select]').dataset.value==='56f40101d2720b2a4d8b45d6'"));
    await until(() => hasMarker(taskName));
    fs.writeFileSync(path.join(root, 'data/overlay-sync-result.json'), JSON.stringify({ ok: true, stateReads, dragLayout: layout, focusable: overlay.isFocusable(), focused: overlay.isFocused() }, null, 2));
  } finally {
    debug.detach();
    ipcMain.removeHandler('companion:state');
    ipcMain.handle('companion:state', e => { secure(e.sender); return store.snapshot(); });
  }
};
