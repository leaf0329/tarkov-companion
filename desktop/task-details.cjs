const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ main, overlay, store, root, dataDir, publish, wait, until, checks }) => {
  const core = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-core.json'))).data.tasks;
  const quest = core.find(task => task.name === '收视灵药');
  const goals = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/tasks-objectives.json'))).data.tasks.find(task => task.id === quest.id).objectives;
  for (const goal of goals) delete store.profile().ui.pve.taskObjectives[goal.id];
  store.profile().ui.pve.taskObjectives[goals[0].id] = { complete: true, timestamp: Date.now() };
  store.event({ kind: 'quest', id: quest.id, profile: store.disk.selectedProfile, status: 'active', at: Date.now(), history: false });
  publish();
  const markerExpression = `Array.from(document.querySelectorAll('.companion-task-marker')).find(m=>m.textContent.trim()===${JSON.stringify(quest.name)})?.querySelector('span')`;
  const drivers = [];
  const makeDriver = win => {
    const js = code => win.webContents.executeJavaScript(code);
    const debug = win.webContents.debugger;
    debug.attach('1.3'); drivers.push(debug);
    const point = expression => js(`(()=>{const el=${expression};if(!el)throw Error('Missing task details target');const r=el.getBoundingClientRect(),marker=el.closest('.companion-task-marker');const points=[[r.left+r.width/2,r.top+r.height/2],[r.left+r.width/4,r.top+r.height/2],[r.right-r.width/4,r.top+r.height/2]];for(const [x,y]of points){const hit=document.elementFromPoint(x,y);if(el.contains(hit)||(marker&&hit?.closest('.companion-task-marker')===marker))return {x,y}}throw Error('Task click target is covered: '+el.textContent)})()`);
    const move = async expression => { await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', ...await point(expression) }); };
    const click = async expression => {
      const position = await point(expression);
      await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position });
      await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', buttons: 1, clickCount: 1 });
      await debug.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position, button: 'left', buttons: 0, clickCount: 1 });
      await wait(250);
    };
    return { js, move, click };
  };
  const savedBounds = overlay.getBounds();
  try {
    for (const win of [main, overlay]) {
      win.showInactive(); await wait(250);
      const { js, move, click } = makeDriver(win);
      await until(() => js(`!!(${markerExpression})`));
      await move(markerExpression); await wait(350);
      assert.equal(await js("document.querySelectorAll('.map-objective-popup').length"), 0, 'hovering a task must not open its details');
      await click(markerExpression);
      await until(() => js("document.querySelectorAll('[data-testid=task-objective-row]').length===5"));
      const rows = await js("Array.from(document.querySelectorAll('[data-testid=task-objective-row]'),row=>({id:row.dataset.objectiveId,text:row.textContent,count:row.querySelector('[data-testid=task-objective-count]')?.textContent,complete:row.querySelector('[data-testid=task-objective-toggle]')?.getAttribute('aria-pressed')}))");
      assert.equal(rows.length, goals.length);
      for (const goal of goals) {
        const row = rows.find(row => row.id === goal.id);
        assert.ok(row.text.includes(goal.description));
      }
      assert.equal(rows[0].complete, 'true');
      assert.equal(rows[0].count.trim(), '1/1');
      assert.equal(rows[4].count.trim(), '0/15');
      await move("document.querySelector('[data-testid=companion-drag-handle]')"); await wait(250);
      assert.equal(await js("document.querySelectorAll('.map-objective-popup').length"), 1, 'a clicked popup stays open after the pointer leaves');
      const otherName = core.find(task => task.id === '5b4795fb86f7745876267770').name;
      await js(`Array.from(document.querySelectorAll('.companion-task-marker')).find(m=>m.textContent.trim()===${JSON.stringify(otherName)}).click()`);
      await until(() => js(`document.querySelector('.map-objective-popup')?.textContent.includes(${JSON.stringify(otherName)})`));
      assert.equal(await js("document.querySelectorAll('.map-objective-popup').length"), 1);
      await click("document.querySelector('[data-testid=objective-close-button]')");
      await until(() => js("document.querySelectorAll('.map-objective-popup').length===0"));
      await move(markerExpression); await wait(250);
      assert.equal(await js("document.querySelectorAll('.map-objective-popup').length"), 0);
      win.webContents.debugger.detach();
      if (win === main) main.hide();
    }
    checks.push('the main map and overlay show all four Viewership camera placements and its 15-target requirement, including completed goals');
    checks.push('task details open with trusted clicks, stay open when the pointer leaves, replace the previous clicked task and remain closed on hover');

    const driver = makeDriver(overlay);
    overlay.setSize(620, 760); await wait(650);
    await driver.click("document.querySelector('[data-testid=map-reset-view]')");
    await driver.click(markerExpression);
    await until(() => driver.js("document.querySelectorAll('[data-testid=task-objective-row]').length===5"));
    await wait(400);
    fs.writeFileSync(path.join(dataDir, 'task-full-details.png'), (await overlay.webContents.capturePage()).toPNG());
    overlay.setSize(380, 320); await wait(900);
    const scroll = await driver.js(`(async()=>{
      const body=document.querySelector('[data-testid=objective-popup-body]'),close=document.querySelector('[data-testid=objective-close-button]');
      const before=close.getBoundingClientRect().top;
      body.scrollTop=body.scrollHeight;await new Promise(requestAnimationFrame);
      const rect=close.getBoundingClientRect(),map=document.querySelector('.leaflet-container').getBoundingClientRect();
      return {scrolls:body.scrollHeight>body.clientHeight,scrollTop:body.scrollTop,headerMovement:Math.abs(before-rect.top),closeVisible:rect.left>=map.left&&rect.right<=map.right&&rect.top>=map.top&&rect.bottom<=map.bottom,closeHit:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.closest('[data-testid=objective-close-button]')===close};
    })()`);
    assert.equal(scroll.scrolls, true);
    assert.ok(scroll.scrollTop > 0);
    assert.ok(scroll.headerMovement < 1);
    assert.equal(scroll.closeVisible, true, JSON.stringify(scroll));
    assert.equal(scroll.closeHit, true, JSON.stringify(scroll));
    await wait(250);
    assert.ok(await driver.js("document.querySelector('[data-testid=objective-popup-body]').scrollTop>0"), 'scrolling must persist after the next painted frame');
    fs.writeFileSync(path.join(dataDir, 'task-details-small-scrolled.png'), (await overlay.webContents.capturePage()).toPNG());
    await driver.click("document.querySelector('[data-testid=objective-close-button]')");
    await until(() => driver.js("document.querySelectorAll('.map-objective-popup').length===0"));
    checks.push('a long task scrolls inside the smallest overlay while its close button stays visible and responds to a trusted click');
    fs.writeFileSync(path.join(root, 'data/task-details-result.json'), JSON.stringify({ ok: true, objectives: goals.map(goal => ({ id: goal.id, description: goal.description, count: goal.count })), scroll }, null, 2));
  } finally {
    for (const debug of drivers) if (debug.isAttached()) debug.detach();
    overlay.setBounds(savedBounds);
  }
};
