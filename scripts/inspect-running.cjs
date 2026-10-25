const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const pid = Number(process.argv[2]);
const output = path.join(root, 'data', 'live-window-diagnostics.json');
const rendererProbe = `(()=>{
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
 const describe=el=>el?{tag:el.tagName,id:el.id,class:String(el.className),testid:el.getAttribute('data-testid'),inert:el.inert,pointerEvents:getComputedStyle(el).pointerEvents}:null;
 const controls=Array.from(document.querySelectorAll('[data-testid=companion-toolbar] button,[data-testid=companion-map-select],[data-testid=companion-floor-select]')).map(el=>{
  const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {text:el.textContent.trim(),disabled:el.disabled,bounds:rect(el),element:describe(el),hit:describe(hit),hitInside:!!hit&&el.contains(hit)};
 });
 return {url:location.href,visibility:document.visibilityState,focus:document.hasFocus(),body:describe(document.body),html:describe(document.documentElement),active:describe(document.activeElement),controls,inertElements:Array.from(document.querySelectorAll('[inert]')).map(describe),dialogs:Array.from(document.querySelectorAll('[role=dialog],[role=listbox],[data-reka-popper-content-wrapper]')).map(el=>({element:describe(el),bounds:rect(el)})),dragging:document.body.classList.contains('leaflet-dragging'),bridge:!!window.companion};
})()`;

async function portIsFree() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9229, '127.0.0.1', resolve); });
  await new Promise(resolve => server.close(resolve));
}

async function main() {
  if (!Number.isInteger(pid) || pid <= 0) throw Error('Expected the running assistant process id');
  await portIsFree();
  process._debugProcess(pid);
  let targets;
  for (let n = 0; n < 30; n++) {
    try { targets = await (await fetch('http://127.0.0.1:9229/json/list', { signal: AbortSignal.timeout(1000) })).json(); break; }
    catch (error) { if (n === 29) throw error; await delay(100); }
  }
  if (targets.length !== 1) throw Error('Expected exactly one inspector target');
  const address = new URL(targets[0].webSocketDebuggerUrl);
  if (address.hostname !== '127.0.0.1') throw Error('Inspector must be local');
  const ws = new WebSocket(address);
  const pending = new Map();
  let id = 0, owned = false;
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  const call = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(Error(method + ' timed out')); }, 12000);
    pending.set(requestId, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  try {
    const actualPid = await evaluate('process.pid');
    if (actualPid !== pid) throw Error('Inspector process mismatch');
    owned = true;
    if (process.argv.includes('--repair-overlay')) {
      await evaluate(`(()=>{
        const require=process.getBuiltinModule('module').createRequire(${JSON.stringify(path.join(root, 'desktop/main.cjs'))});
        const electron=require('electron');
        if(electron.app.getAppPath().toLowerCase()!==${JSON.stringify(root.toLowerCase())})throw Error('Not the intended assistant');
        if(globalThis.__companionOverlayInputRepair)throw Error('Overlay repair already applied');
        const windows=electron.BrowserWindow.getAllWindows().filter(win=>!win.isFocusable());
        if(windows.length!==1)throw Error('Expected one nonactivating overlay');
        require(${JSON.stringify(path.join(root, 'desktop/overlay-input.cjs'))}).attachOverlayInput(windows[0]);
        globalThis.__companionOverlayInputRepair=true;
        return true;
      })()`);
    }
    if (process.argv.includes('--observe')) {
      await evaluate(`(async()=>{
        const require=process.getBuiltinModule('module').createRequire(${JSON.stringify(path.join(root, 'desktop/main.cjs'))});
        const electron=require('electron');
        if(electron.app.getAppPath().toLowerCase()!==${JSON.stringify(root.toLowerCase())})throw Error('Not the intended assistant');
        return require(${JSON.stringify(path.join(root, 'scripts/observe-running-input.cjs'))}).start(electron,${JSON.stringify(path.join(root, 'data/live-input-diagnostics.jsonl'))});
      })()`);
    }
    const windows = await evaluate(`(async()=>{
      const electron=process.getBuiltinModule('module').createRequire(${JSON.stringify(path.join(root, 'desktop/main.cjs'))})('electron');
      if(electron.app.getAppPath().toLowerCase()!==${JSON.stringify(root.toLowerCase())})throw Error('Not the intended assistant');
      return Promise.all(electron.BrowserWindow.getAllWindows().map(async win=>{
        const result={id:win.id,title:win.getTitle(),bounds:win.getBounds(),enabled:win.isEnabled(),visible:win.isVisible(),focusable:win.isFocusable(),focused:win.isFocused(),loading:win.webContents.isLoading(),rendererPid:win.webContents.getOSProcessId(),backgroundThrottling:win.webContents.getBackgroundThrottling()};
        try{result.page=await Promise.race([win.webContents.executeJavaScript(${JSON.stringify(rendererProbe)}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Renderer evaluation timeout')),5000))]);}
        catch(error){result.error=String(error);}
        return result;
      }));
    })()`);
    fs.writeFileSync(output, JSON.stringify({ capturedAt: new Date().toISOString(), pid, windows }, null, 2));
    if (process.argv.includes('--quit')) await evaluate(`setTimeout(()=>process.getBuiltinModule('module').createRequire(${JSON.stringify(path.join(root, 'desktop/main.cjs'))})('electron').app.quit(),500);true`);
  } finally {
    if (owned && ws.readyState === WebSocket.OPEN) await call('Runtime.evaluate', { expression: "setImmediate(()=>process.getBuiltinModule('inspector').close());'closing'", returnByValue: true }).catch(error => fs.appendFileSync(output + '.error', String(error)));
    ws.close();
  }
}

main().catch(error => {
  fs.writeFileSync(output + '.error', String(error.stack || error));
  process.exitCode = 1;
});
