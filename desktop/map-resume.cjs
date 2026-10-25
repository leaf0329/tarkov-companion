const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ main, overlay, store, root, publish, wait, until, checks }) => {
  let target = overlay;
  const js = code => target.webContents.executeJavaScript(code);
  let debug = target.webContents.debugger;
  const state = () => js(`({hidden:document.hidden,bodyClass:document.body.className,pointerEvents:getComputedStyle(document.body).pointerEvents,disabledButtons:Array.from(document.querySelectorAll('[data-testid=companion-toolbar] button')).filter(b=>b.disabled).map(b=>b.textContent),menus:document.querySelectorAll('[role=listbox]').length})`);
  const point = selector => js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing resume control: '+${JSON.stringify(selector)});const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  const mouse = (type, at, held = false) => debug.sendCommand('Input.dispatchMouseEvent', { type, ...at, button: type === 'mouseMoved' ? 'none' : 'left', buttons: held ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
  const click = async selector => {
    const at = await point(selector);
    await mouse('mouseMoved', at);
    await mouse('mousePressed', at, true);
    await mouse('mouseReleased', at);
    await wait(150);
  };
  const controls = async () => {
    for (const [key, selector] of [['autoScreenshot', '[data-testid=companion-capture-toggle]'], ['follow', '[data-testid=companion-follow-toggle]']]) {
      const before = store.disk.settings[key];
      await click(selector);
      await until(() => store.disk.settings[key] !== before);
      await click(selector);
      await until(() => store.disk.settings[key] === before);
    }
    await click('[data-testid=companion-map-select]');
    await until(() => js("document.querySelectorAll('[role=option]').length>0"));
    await click('[role=option][data-state=checked]');
    await until(() => js("document.querySelectorAll('[role=option]').length===0"));
  };
  const result = { ok: false, startedAt: new Date().toISOString(), phases: [] };
  main.hide(); overlay.showInactive(); debug.attach('1.3');
  try {
    await controls();
    overlay.hide();
    const old = store.runtime.position;
    const markerBefore = await js("document.querySelector('.companion-player').style.transform");
    const started = Date.now();
    const quick = process.argv.includes('--quick-resume-test');
    result.quick = quick;
    for (let n = 0; n < (quick ? 0 : 30); n++) {
      store.event({ kind: 'position', mode: 'pve', profile: store.disk.selectedProfile, map: old.map, x: old.x + n * 2, y: old.y, z: old.z + n, yaw: n * 5, at: Date.now() });
      store.runtime.capture = { ...store.runtime.capture, message: 'background endurance ' + n };
      publish();
      await wait(5000);
    }
    if (quick) { store.event({ kind: 'position', mode: 'pve', profile: store.disk.selectedProfile, map: old.map, x: old.x + 2, y: old.y, z: old.z + 1, yaw: 90, at: Date.now() }); publish(); }
    overlay.showInactive();
    await until(() => js("document.querySelector('.companion-player').style.transform!==" + JSON.stringify(markerBefore)));
    await controls();
    result.backgroundMs = Date.now() - started;
    result.phases.push({ name: 'background with coordinate updates', state: await state() });
    if (!quick) checks.push('after 150 seconds in the background, coordinates update and trusted map/capture/Follow controls still work');

    const visibleStarted = Date.now();
    if (!quick) { await wait(40000); await wait(35000); }
    await controls();
    result.visibleIdleMs = Date.now() - visibleStarted;
    result.phases.push({ name: 'visible idle', state: await state() });
    if (!quick) checks.push('after 75 seconds without input while visible, trusted map/capture/Follow controls still work');

    await click('[data-testid=companion-map-select]');
    await until(() => js("document.querySelectorAll('[role=option]').length>0"));
    overlay.hide(); await wait(300); overlay.showInactive(); await wait(300);
    await until(() => js("document.querySelectorAll('[role=option]').length===0"));
    await controls();
    result.phases.push({ name: 'hidden with map menu open', state: await state() });
    checks.push('hiding the overlay with a map menu open does not trap later toolbar clicks');

    const start = await js("(()=>{const r=document.querySelector('.leaflet-container').getBoundingClientRect();return {x:r.left+r.width*.6,y:r.top+r.height*.6}})()");
    await mouse('mouseMoved', start);
    await mouse('mousePressed', start, true);
    await mouse('mouseMoved', { x: start.x + 45, y: start.y + 30 }, true);
    assert.equal(await js("document.body.classList.contains('leaflet-dragging')"), true, 'fixture must start a real Leaflet drag');
    overlay.hide(); await wait(300); overlay.showInactive(); await wait(300);
    result.phases.push({ name: 'hidden during drag without mouseup', state: await state() });
    assert.equal(await js("document.body.classList.contains('leaflet-dragging')"), false, 'hide/show must release an interrupted drag without requiring mouseup');
    await controls();
    checks.push('an interrupted drag is released on hide/show and toolbar controls remain usable');
    await js("window.__resumeMoves=[];document.addEventListener('pointermove',e=>{window.__resumeMoves.push({buttons:e.buttons,button:e.button,trusted:e.isTrusted});if(window.__resumeMoves.length>10)window.__resumeMoves.shift()},true)");

    for (let n = 0; n < 8; n++) {
      const before = await js("document.querySelector('.leaflet-map-pane').style.transform");
      await mouse('mouseMoved', start);
      await mouse('mousePressed', start, true);
      await mouse('mouseMoved', { x: start.x + 18, y: start.y + 12 }, true);
      assert.equal(await js("document.body.classList.contains('leaflet-dragging')"), true);
      if (n % 2) { overlay.hide(); await wait(100); overlay.showInactive(); }
      else await mouse('mouseMoved', { x: start.x + 22, y: start.y + 15 });
      await until(() => js("!document.body.classList.contains('leaflet-dragging')"));
      await mouse('mouseMoved', start);
      await mouse('mousePressed', start, true);
      await mouse('mouseMoved', { x: start.x - 35, y: start.y - 20 }, true);
      await mouse('mouseReleased', { x: start.x - 35, y: start.y - 20 });
      await wait(100);
      assert.notEqual(await js("document.querySelector('.leaflet-map-pane').style.transform"), before);
      await controls();
    }
    const background = "Array.from(document.querySelectorAll('.leaflet-pane')).find(p=>p.style.zIndex==='200')?.querySelector('svg')";
    await click('[data-testid=map-reset-view]'); await wait(300);
    const zoomBefore = await js(`(${background}).getBoundingClientRect().width`);
    await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', ...start, deltaX: 0, deltaY: -120 });
    await wait(500);
    assert.ok(await js(`(${background}).getBoundingClientRect().width`) > zoomBefore);
    checks.push('eight interrupted drag/reopen cycles still allow fresh drags, trusted buttons and wheel zoom without giving the overlay keyboard focus');
    assert.equal(overlay.isFocusable(), false);
    assert.equal(overlay.isFocused(), false);
    debug.detach(); overlay.hide(); target = main; main.showInactive();
    debug = main.webContents.debugger; debug.attach('1.3');
    await controls();
    const mainStart = await js("(()=>{const r=document.querySelector('.leaflet-container').getBoundingClientRect();return {x:r.left+r.width*.6,y:r.top+r.height*.6}})()");
    await mouse('mouseMoved', mainStart);
    await mouse('mousePressed', mainStart, true);
    await mouse('mouseMoved', { x: mainStart.x + 40, y: mainStart.y + 30 }, true);
    assert.equal(await js("document.body.classList.contains('leaflet-dragging')"), true);
    main.minimize(); await until(() => main.isMinimized()); await wait(200); main.restore(); main.showInactive();
    await until(() => js("!document.body.classList.contains('leaflet-dragging')"));
    await controls();
    result.phases.push({ name: 'main window after background and interrupted minimize/restore', state: await state() });
    checks.push('the main window still accepts trusted controls after prolonged backgrounding and releases a drag interrupted by minimize/restore');
    main.hide(); overlay.showInactive();
    result.ok = true;
  } catch (error) {
    result.error = error.stack;
    result.failureState = await state().catch(() => null);
    result.pointerEvents = await js('window.__resumeMoves').catch(() => null);
    throw error;
  } finally {
    if (debug.isAttached()) debug.detach();
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(root, 'data/map-resume-result.json'), JSON.stringify(result, null, 2));
  }
};
