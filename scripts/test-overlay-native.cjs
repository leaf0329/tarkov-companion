const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const koffi = require('koffi');
const { attachOverlayInput } = require('../desktop/overlay-input.cjs');
const output = path.resolve(__dirname, '../data/native-overlay-result.json');
app.setPath('userData', path.resolve(__dirname, '../data/acceptance/native-input'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, frame: false, focusable: false, webPreferences: { sandbox: true } });
  const handle = window.getNativeWindowHandle().readBigUInt64LE();
  const send = koffi.load('user32.dll').func('intptr_t __stdcall SendMessageW(void *window, uint32_t message, uintptr_t wParam, intptr_t lParam)');
  const activate = hit => Number(send(handle, 0x21, handle, (0x201 << 16) | hit));
  const before = activate(1);
  attachOverlayInput(window);
  const results = [1, 2, 10, 11, 12].map(hit => ({ hit, result: activate(hit) }));
  for (const { result } of results) assert.equal(result, 3, 'retain mouse-down without activating the overlay');
  assert.equal(window.isFocusable(), false);
  assert.equal(window.isFocused(), false);
  window.setSize(540, 420);
  assert.equal(activate(1), 3);
  window.destroy();
  await new Promise(resolve => setImmediate(resolve));
  fs.writeFileSync(output, JSON.stringify({ ok: true, before, results, focusable: false, destroyed: window.isDestroyed() }, null, 2));
  app.quit();
}).catch(error => {
  fs.writeFileSync(output, JSON.stringify({ ok: false, error: error.stack }, null, 2));
  app.exit(1);
});
