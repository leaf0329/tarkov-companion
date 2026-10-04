const {app,BrowserWindow,globalShortcut,screen,Menu,dialog,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {validateOverlaySettings,validateOverlayOpacity}=require('../overlay-settings.cjs');
const {attachExternalLinks,chooseDirectory}=require('./native-actions.cjs');
const root=path.resolve(__dirname,'..'),cache=process.env.TARKOV_OVERLAY_CACHE || path.join(root,'data/overlay-runtime');
fs.mkdirSync(cache,{recursive:true});
app.setPath('userData',cache);app.setPath('sessionData',cache);
const port=Number(process.env.TARKOV_OVERLAY_PORT || 18765);
if(!Number.isInteger(port) || port<1024 || port>65535)app.exit(1);
const origin=`http://127.0.0.1:${port}`,url=origin+'/?overlay=1';
const boundsFile=path.join(cache,'window.json');
let win,quitting=false,hotkey=null,shortcutRegistered=false,error=null;
const send=value=>{if(process.connected)process.send(value,error=>{if(error)app.quit();});};
function state(){return {ready:!!win && !win.isDestroyed(),visible:!!win?.isVisible(),focusable:win && !win.isDestroyed()?win.isFocusable():null,opacity:win && !win.isDestroyed()?Math.round(win.getOpacity()*100):100,alwaysOnTop:!!win?.isAlwaysOnTop(),fullscreen:!!win?.isFullScreen(),hotkey,shortcutRegistered,error,bounds:win && !win.isDestroyed()?win.getBounds():null};}
function publish(){send({kind:'state',state:state()});}
function hide(){if(win.isFullScreen())win.setFullScreen(false);win.hide();publish();}
function show(){win.setAlwaysOnTop(true,'screen-saver');win.showInactive();publish();}
function toggle(){if(win.isVisible())hide();else show();}
function configure(message) {
  const config=validateOverlaySettings(message.overlayHotkeyEnabled,message.overlayHotkey,message.overlayOpacity);
  const next=config.overlayHotkey;
  if(config.overlayHotkeyEnabled && (!shortcutRegistered || hotkey!==next)) {
    if(!globalShortcut.register(next,toggle))throw new Error(`快捷键 ${next} 已被其他程序占用，请在设置中改键。`);
    if(shortcutRegistered && hotkey!==next)globalShortcut.unregister(hotkey);
    hotkey=next;shortcutRegistered=true;
  }else if(!config.overlayHotkeyEnabled) {
    if(shortcutRegistered)globalShortcut.unregister(hotkey);
    hotkey=next;shortcutRegistered=false;
  }
  win.setOpacity(config.overlayOpacity/100);
  error=null;publish();
}
function saveBounds() {
  if(!win || win.isDestroyed() || win.isFullScreen())return;
  const bounds=win.getNormalBounds();fs.writeFileSync(boundsFile,JSON.stringify(bounds));
}
const ready=app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);
  const area=screen.getPrimaryDisplay().workArea;
  let saved;try{saved=JSON.parse(fs.readFileSync(boundsFile,'utf8'));}catch{}
  const valid=saved && ['x','y','width','height'].every(k=>Number.isFinite(saved[k])) && screen.getAllDisplays().some(d=>{const a=d.workArea;return saved.x+saved.width>a.x+80 && saved.x<a.x+a.width-80 && saved.y+saved.height>a.y+40 && saved.y<a.y+a.height-40;});
  const width=Math.min(valid?saved.width:720,area.width),height=Math.min(valid?saved.height:620,area.height);
  win=new BrowserWindow({width,height,x:valid?saved.x:area.x+area.width-width-24,y:valid?saved.y:area.y+60,minWidth:360,minHeight:300,
    title:'leaf0329 · 塔科夫置顶地图',frame:false,show:false,focusable:false,alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#15191e',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,partition:'tarkov-overlay'}});
  win.setAlwaysOnTop(true,'screen-saver');
  win.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===win.webContents && contents.getURL().startsWith(origin+'/') && permission==='fullscreen'));
  attachExternalLinks(win.webContents,{shell,localUrl:url,onError:e=>{error='链接打开失败：'+e.message;publish();}});
  win.webContents.on('before-input-event',(event,input)=>{if(input.key==='Tab')event.preventDefault();});
  win.on('close',event=>{if(!quitting){event.preventDefault();hide();}});
  let saveTimer;
  for(const event of ['move','resize'])win.on(event,()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveBounds();publish();},300);});
  for(const event of ['show','hide','enter-full-screen','leave-full-screen','enter-html-full-screen','leave-html-full-screen'])win.on(event,publish);
  win.webContents.on('render-process-gone',(_event,details)=>{error='浮窗页面已退出：'+details.reason;publish();});
  await win.loadURL(url);
  send({kind:'ready',state:state()});
});
ready.catch(e=>{send({kind:'fatal',error:e.message});app.quit();});
let commands=Promise.resolve();
process.on('message',message=>{commands=commands.then(async()=>{
  try {
    if(message.action==='quit'){app.quit();return;}
    await ready;
    if(message.action==='choose-directory'){
      const result=await chooseDirectory(dialog,message);
      send({kind:'reply',id:message.id,state:result});return;
    }
    if(message.action==='configure')configure(message);
    else if(message.action==='opacity'){win.setOpacity(validateOverlayOpacity(message.opacity)/100);publish();}
    else if(message.action==='show')show();
    else if(message.action==='hide')hide();
    else if(message.action==='toggle')toggle();
    else if(message.action!=='status')throw new Error('未知浮窗操作');
    send({kind:'reply',id:message.id,state:state()});
  }catch(e){error=e.message;publish();send({kind:'reply',id:message.id,error:e.message});}
});});
process.on('disconnect',()=>app.quit());
app.on('before-quit',()=>{quitting=true;saveBounds();globalShortcut.unregisterAll();});
app.on('window-all-closed',()=>{if(quitting)app.quit();});
