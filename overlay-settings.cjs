function validateOverlayOpacity(opacity) {
  if(!Number.isInteger(opacity) || opacity<25 || opacity>100)throw new Error('浮窗不透明度须为 25～100 的整数');
  return opacity;
}
function validateOverlaySettings(enabled,hotkey,opacity=100) {
  if(typeof enabled!=='boolean' || typeof hotkey!=='string')throw new Error('浮窗快捷键设置无效');
  const parts=hotkey.trim().split('+').map(p=>p.trim()),key=parts.pop()?.toUpperCase();
  const modifiers=parts.map(p=>({ctrl:'Control',control:'Control',alt:'Alt',shift:'Shift'}[p.toLowerCase()]));
  if(modifiers.some(p=>!p) || new Set(modifiers).size!==modifiers.length || !/^(F[1-9]|F10|F11|[A-Z0-9])$/.test(key || '') || (!modifiers.length && !/^F\d+$/.test(key)))throw new Error('请使用 F1～F11，或 Ctrl / Alt / Shift 加字母、数字。Insert 保留给游戏截图。');
  const ordered=['Control','Alt','Shift'].filter(m=>modifiers.includes(m));
  return {overlayHotkeyEnabled:enabled,overlayHotkey:[...ordered,key].join('+'),overlayOpacity:validateOverlayOpacity(opacity)};
}
module.exports={validateOverlaySettings,validateOverlayOpacity};
