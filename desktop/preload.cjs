const {contextBridge,ipcRenderer}=require('electron');
let revision=0;
const remember=value=>{revision=Math.max(revision,value.progressRevision);return value;};
contextBridge.exposeInMainWorld('companion',{
  getState:()=>ipcRenderer.invoke('companion:state').then(remember),
  saveProgress:value=>ipcRenderer.invoke('companion:progress',{...value,revision}),
  saveSettings:value=>ipcRenderer.invoke('companion:settings',value),
  chooseDirectory:kind=>ipcRenderer.invoke('companion:directory',kind),
  overlay:()=>ipcRenderer.invoke('companion:overlay'),
  fullscreen:()=>ipcRenderer.invoke('companion:fullscreen'),
  subscribeWindowReset:callback=>{const listener=(_event,reason)=>callback(reason);ipcRenderer.on('companion:window-reset',listener);return ()=>ipcRenderer.removeListener('companion:window-reset',listener);},
  subscribe:callback=>{const listener=(_event,data)=>callback(remember(data));ipcRenderer.on('companion:state-update',listener);return ()=>ipcRenderer.removeListener('companion:state-update',listener);}
});
