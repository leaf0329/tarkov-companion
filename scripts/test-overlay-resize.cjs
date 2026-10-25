const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const koffi = require('koffi');
const directory = path.resolve(__dirname, '../data/acceptance/overlay-resize-20261020');
fs.mkdirSync(directory, { recursive: true });
app.setPath('userData', path.join(directory, 'browser'));
app.on('window-all-closed', () => {});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const record = value => fs.appendFileSync(path.join(directory, 'events.log'), JSON.stringify(value) + '\n');
fs.writeFileSync(path.join(directory, 'events.log'), '');
process.on('uncaughtExceptionMonitor', error => record({ error: error.stack }));
app.whenReady().then(async () => {
  const { attachOverlayInput } = require('../desktop/overlay-input.cjs');
  const window = new BrowserWindow({ x: 40, y: 80, width: 620, height: 570, minWidth: 380, minHeight: 320, show: false, frame: false, focusable: false, alwaysOnTop: true, webPreferences: { sandbox: true } });
  const handle = window.getNativeWindowHandle().readBigUInt64LE();
  const user32 = koffi.load('user32.dll');
  const send = user32.func('intptr_t __stdcall SendMessageW(void *window, uint32_t message, uintptr_t wParam, intptr_t lParam)');
  const post = user32.func('int __stdcall PostMessageW(void *window, uint32_t message, uintptr_t wParam, intptr_t lParam)');
  const cursor = user32.func('int __stdcall SetCursorPos(int x, int y)');
  koffi.struct('CompanionTestPoint', { x: 'int32_t', y: 'int32_t' });
  const previousCursor = {};
  user32.func('int __stdcall GetCursorPos(_Out_ CompanionTestPoint *point)')(previousCursor);
  attachOverlayInput(window);
  await window.loadURL('data:text/html,<body style="background:%23111827;color:white"><button>Resize regression</button></body>');
  window.showInactive();
  for (const size of [[540, 420], [380, 320], [100, 100], [620, 570]]) {
    window.setSize(...size);
    await wait(150);
    record({ requested: size, actual: window.getSize() });
  }
  for (let cycle = 0; cycle < 3; cycle++) {
  window.setSize(620, 570);
  const bounds = window.getBounds();
  cursor(bounds.x + bounds.width - 2, bounds.y + bounds.height - 2);
  // A separate process releases the native sizing loop even if the main JS thread fails.
  const helper = spawn(process.execPath, ['-e', `
    const koffi=require('koffi'),u=koffi.load('user32.dll');
    const cursor=u.func('int __stdcall SetCursorPos(int x,int y)');
    const mouse=u.func('void __stdcall mouse_event(uint32_t flags,uint32_t x,uint32_t y,uint32_t data,uintptr_t extra)');
    const post=u.func('int __stdcall PostMessageW(void *window,uint32_t message,uintptr_t wParam,intptr_t lParam)');
    let step=0;
    const timer=setInterval(()=>{cursor(${bounds.x + bounds.width - 2}-step*40,${bounds.y + bounds.height - 2}-step*40);if(++step>10){clearInterval(timer);mouse(4,0,0,0,0);post(BigInt('${handle}'),0x1f,0,0);}},100);
  `], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  helper.stderr.on('data', chunk => record({ helper: String(chunk) }));
  const finished = new Promise(resolve => helper.once('exit', resolve));
  record({ stage: 'native-sizing-loop', cycle });
  assert.equal(post(handle, 0x112, 0xf008, 0), 1);
  await finished;
  await wait(300);
  record({ stage: 'after-native-sizing-loop', bounds: window.getBounds() });
  assert.ok(window.getSize()[0] < bounds.width || window.getSize()[1] < bounds.height);
  assert.equal(Number(send(handle, 0x21, handle, 0x2010001)), 3);
  assert.equal(window.isFocusable(), false);
  assert.equal(window.isFocused(), false);
  }
  cursor(previousCursor.x, previousCursor.y);
  window.destroy();
  await wait(450);
  fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ ok: true }, null, 2));
  app.quit();
}).catch(error => {
  record({ error: error.stack });
  app.exit(1);
});
