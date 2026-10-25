const fs = require('node:fs');

function pageObserver() {
  window.__companionInputObservation?.stop();
  const events = [];
  const record = event => {
    const target = event.target?.closest?.('button,[data-testid],.leaflet-container');
    events.push({ at: Date.now(), type: event.type, x: event.clientX, y: event.clientY, buttons: event.buttons, target: target?.getAttribute('data-testid') ?? target?.tagName, text: target?.tagName === 'BUTTON' ? target.textContent.trim().slice(0, 80) : undefined });
    if (events.length > 100) events.shift();
  };
  const types = ['pointerdown', 'pointerup', 'pointercancel', 'click', 'wheel'];
  for (const type of types) document.addEventListener(type, record, { capture: true, passive: true });
  window.__companionInputObservation = {
    read: () => ({ at: Date.now(), focus: document.hasFocus(), events: events.splice(0), dragging: document.body.classList.contains('leaflet-dragging'), controls: Array.from(document.querySelectorAll('[data-testid=companion-toolbar] button,[data-testid=companion-map-select],[data-testid=companion-floor-select]')).map(el => ({ text: el.textContent.trim(), expanded: el.getAttribute('aria-expanded'), disabled: el.disabled })) }),
    stop: () => {
      for (const type of types) document.removeEventListener(type, record, true);
      delete window.__companionInputObservation;
    },
  };
  return true;
}

exports.start = async function start(electron, output) {
  globalThis.__companionInputObservation?.stop();
  const nativeEvents = [];
  const bindings = [];
  const windows = electron.BrowserWindow.getAllWindows();
  const write = data => fs.appendFileSync(output, JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n');
  const listen = (source, name, handler) => { source.on(name, handler); bindings.push(() => source.removeListener(name, handler)); };
  fs.writeFileSync(output, '');
  for (const win of windows) {
    const content = win.webContents;
    await content.executeJavaScript(`(${pageObserver.toString()})()`);
    listen(content, 'before-mouse-event', (_event, mouse) => {
      if (mouse.type === 'mouseMove') return;
      nativeEvents.push({ at: Date.now(), window: win.id, type: mouse.type, x: mouse.x, y: mouse.y, button: mouse.button });
      if (nativeEvents.length > 100) nativeEvents.shift();
    });
    for (const name of ['show', 'hide', 'focus', 'blur', 'minimize', 'restore', 'unresponsive', 'responsive']) listen(win, name, () => nativeEvents.push({ at: Date.now(), window: win.id, type: name }));
  }
  let reading = false;
  const sample = async () => {
    if (reading) return;
    reading = true;
    try {
      const cursor = electron.screen.getCursorScreenPoint();
      const states = await Promise.all(windows.filter(win => !win.isDestroyed()).map(async win => {
        const bounds = win.getBounds();
        const state = { id: win.id, visible: win.isVisible(), enabled: win.isEnabled(), focusable: win.isFocusable(), cursorInside: cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width && cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height };
        try { state.page = await Promise.race([win.webContents.executeJavaScript('window.__companionInputObservation?.read()'), new Promise((_, reject) => setTimeout(() => reject(Error('Page probe timeout')), 1000))]); }
        catch (error) { state.error = String(error); }
        return state;
      }));
      write({ nativeEvents: nativeEvents.splice(0), windows: states });
    } finally { reading = false; }
  };
  const interval = setInterval(() => { sample().catch(error => write({ error: String(error) })); }, 1000);
  const stop = () => {
    clearInterval(interval);
    clearTimeout(timeout);
    for (const remove of bindings) remove();
    for (const win of windows) if (!win.isDestroyed()) win.webContents.executeJavaScript('window.__companionInputObservation?.stop()').catch(error => write({ error: String(error) }));
    write({ stopped: true });
    delete globalThis.__companionInputObservation;
  };
  const timeout = setTimeout(stop, 5 * 60 * 1000);
  globalThis.__companionInputObservation = { stop };
  await sample();
  return { output, durationSeconds: 300 };
};
