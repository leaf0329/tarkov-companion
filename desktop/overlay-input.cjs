const path = require('node:path');
const koffi = require('koffi');
const native = koffi.load(path.join(__dirname, '../runtime/overlay/CompanionOverlay.dll'));
const attach = native.func('int __stdcall CompanionAttachOverlay(void *window)');

exports.attachOverlayInput = function attachOverlayInput(window) {
  const handle = window.getNativeWindowHandle().readBigUInt64LE();
  if (!attach(handle)) throw Error('无法启用小地图鼠标输入');
};
