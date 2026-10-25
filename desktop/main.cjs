const {app,BrowserWindow,dialog,globalShortcut,ipcMain,Menu,shell,screen,powerMonitor}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const net=require('node:net');
const {LocalStore}=require('./store.cjs');
const root=path.resolve(__dirname,'..');
let port=18791,origin='http://127.0.0.1:'+port;
const smokeTest=process.argv.includes('--smoke-test');
const dataDir=path.join(root,'data',...(smokeTest?['acceptance',...(process.argv.includes('--overlay-fixes-check')?['overlay-fixes-20261020']:[])]:[]));
if(smokeTest)process.env.TARKOV_INPUT_DRY_RUN='1';
app.setPath('userData',path.join(dataDir,'browser'));
let main,overlay,server,monitor,shot,registered=null,quitting=false,heartbeat,publishTimer;
const store=new LocalStore(root,dataDir);
const windows=()=>[main,overlay].filter(w=>w && !w.isDestroyed());
const publishedRevisions=new Map();
function publish(){if(publishTimer || quitting)return;publishTimer=setTimeout(()=>{publishTimer=null;for(const w of windows()){const id=w.webContents.id,includeProgress=publishedRevisions.get(id)!==store.progressRevision;w.webContents.send('companion:state-update',store.snapshot(includeProgress));publishedRevisions.set(id,store.progressRevision);}},16);}
function toggle(){if(overlay.isVisible())overlay.hide();else{overlay.setAlwaysOnTop(true,'screen-saver');overlay.showInactive();}publish();}
function hotkey(key){if(!/^(F[1-9]|F10|F11)$/.test(key))throw Error('快捷键请使用 F1～F11');if(registered===key)return;if(!globalShortcut.register(key,toggle))throw Error(key+' 已被其他程序占用，请关闭旧助手或换一个键');if(registered)globalShortcut.unregister(registered);registered=key;store.runtime.hotkeyError=null;}
function configureShot(){const s=store.disk.settings;shot.configure(s.autoScreenshot,s.interval);}
function needsSetup(){return !store.disk.settings.logsPath || !store.disk.settings.screenshotsPath;}
function startMonitor(){
  if(monitor){monitor.removeAllListeners('exit');monitor.kill();monitor=null;}
  const s=store.disk.settings;
  store.runtime.ready=false;
  if(needsSetup()){store.runtime.error='请在本地设置中选择游戏 Logs 和 Screenshots 目录，再保存全部设置。';return;}
  const config=path.join(dataDir,'monitor-config.json');
  fs.writeFileSync(config,JSON.stringify({logsPath:s.logsPath,screenshotsPath:s.screenshotsPath,mapsPath:path.join(root,'data/maps.json'),parentProcessId:process.pid}));
  monitor=spawn(path.join(root,'runtime/monitor/LocalMonitor.exe'),[config],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let partial='';
  monitor.stdout.setEncoding('utf8');monitor.stdout.on('data',chunk=>{
    const lines=(partial+chunk).split(/\r?\n/);partial=lines.pop();
    for(const line of lines){try{const e=JSON.parse(line);store.event(e);if(e.kind==='position')cleanScreenshot(e.filename);publish();}catch(error){store.runtime.error='本地日志桥：'+error.message;}}
  });
  monitor.stderr.on('data',chunk=>{store.runtime.error=String(chunk).slice(-350);publish();});
  monitor.on('error',e=>{store.runtime.error=e.message;publish();});
  monitor.on('exit',()=>{if(!quitting){store.runtime.ready=false;store.runtime.error='日志组件已停止，可在本地设置中重新保存目录';publish();}});
}
const pendingCleanup=new Map();
function cleanScreenshot(name){
  if(!store.disk.settings.cleanupScreenshots || path.basename(name)!==name)return;
  const folder=store.disk.settings.screenshotsPath,file=path.join(folder,name);
  if(pendingCleanup.has(file))return;
  const timer=setTimeout(()=>{pendingCleanup.delete(file);try{const stat=fs.lstatSync(file);if(stat.isFile() && !stat.isSymbolicLink() && Date.now()-stat.mtimeMs>=3000)fs.unlinkSync(file);}catch{}},4000);
  pendingCleanup.set(file,timer);
}
function secure(event){if(!event.sender.getURL().startsWith(origin+'/'))throw Error('无效窗口');}
function attachWindow(win){
  for(const reason of ['show','hide','minimize','restore','blur'])win.on(reason,()=>win.webContents.send('companion:window-reset',reason));
  win.webContents.on('did-finish-load',()=>{publishedRevisions.delete(win.webContents.id);publish();});
  win.webContents.on('will-prevent-unload',event=>event.preventDefault());
  win.on('page-title-updated',event=>event.preventDefault());
  win.webContents.on('console-message',event=>{if(event.message)fs.appendFileSync(path.join(dataDir,'renderer.log'),event.message+'\n');});
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',event=>{if(!event.url.startsWith(origin+'/')){event.preventDefault();if(/^https:\/\//.test(event.url))shell.openExternal(event.url);}});
}
function logError(error){fs.appendFileSync(path.join(dataDir,'startup-error.log'),new Date().toISOString()+' '+String(error.stack || error)+'\n');}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(main && !main.isDestroyed()){if(main.isMinimized())main.restore();main.show();main.focus();}});
 app.whenReady().then(async()=>{
  for(let candidate=18791;candidate<18810;candidate++){
    const free=await new Promise(resolve=>{const probe=net.createServer();probe.once('error',()=>resolve(false));probe.listen(candidate,'127.0.0.1',()=>probe.close(()=>resolve(true)));});
    if(free){port=candidate;origin='http://127.0.0.1:'+port;break;}
    if(candidate===18809)throw Error('本机助手端口已被占用');
  }
  server=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',COMPANION_PARENT_PID:String(process.pid),COMPANION_CATALOG_DIR:path.join(root,'data/catalog'),HOST:'127.0.0.1',PORT:String(port),NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_API_PROTECTION_ALLOWED_HOSTS:'127.0.0.1,localhost',NUXT_PUBLIC_APP_URL:origin,NUXT_PUBLIC_TARKOV_ACCESS_ENABLED:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.on('error',logError);
  const output=fs.createWriteStream(path.join(dataDir,'server.log'),{flags:'a'});server.stdout.pipe(output);server.stderr.pipe(output);
  let available=false;
  for(let n=0;n<150;n++){try{const r=await fetch(origin+'/companion-map');if(r.ok){available=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  if(!available)throw Error('本地任务服务启动失败，请查看 data/server.log');
  const preferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false};
  main=new BrowserWindow({width:1460,height:940,minWidth:900,minHeight:620,title:'leaf0329 · 塔科夫整合助手',backgroundColor:'#111827',show:false,webPreferences:preferences});
  main.on('closed',()=>{main=null;app.quit();});
  const area=screen.getPrimaryDisplay().workArea,saved=store.disk.settings.overlayBounds;
  const bounds=saved && screen.getAllDisplays().some(d=>saved.x+saved.width>d.workArea.x && saved.x<d.workArea.x+d.workArea.width)?saved:{x:area.x+area.width-660,y:area.y+80,width:620,height:570};
  overlay=new BrowserWindow({...bounds,minWidth:380,minHeight:320,title:'leaf0329 · 实时地图',frame:false,focusable:false,skipTaskbar:true,alwaysOnTop:true,show:false,backgroundColor:'#111827',webPreferences:preferences});
  require('./overlay-input.cjs').attachOverlayInput(overlay);
  overlay.setOpacity(store.disk.settings.opacity/100);overlay.setAlwaysOnTop(true,'screen-saver');
  overlay.on('show',()=>{publishedRevisions.delete(overlay.webContents.id);publish();});
  overlay.webContents.on('before-input-event',(event,input)=>{if(input.key==='Tab')event.preventDefault();});
  overlay.on('close',event=>{if(!quitting){event.preventDefault();overlay.hide();}});
  let saveTimer;for(const event of ['move','resize'])overlay.on(event,()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!overlay.isFullScreen()){store.disk.settings.overlayBounds=overlay.getBounds();store.save();}},400);});
  overlay.once('closed',()=>clearTimeout(saveTimer));
  attachWindow(main);attachWindow(overlay);
  powerMonitor.on('resume',()=>{for(const win of windows())win.webContents.send('companion:window-reset','resume');});
  ipcMain.handle('companion:state',event=>{secure(event);return store.snapshot();});
  ipcMain.handle('companion:progress',(event,value)=>{secure(event);if(store.saveUI(value))publish();return store.snapshot();});
  ipcMain.handle('companion:overlay',event=>{secure(event);toggle();});
  ipcMain.handle('companion:fullscreen',event=>{secure(event);const w=BrowserWindow.fromWebContents(event.sender);w.setFullScreen(!w.isFullScreen());});
  ipcMain.handle('companion:directory',async(event,kind)=>{secure(event);if(!['logsPath','screenshotsPath'].includes(kind))throw Error('目录类型无效');const r=await dialog.showOpenDialog(main,{properties:['openDirectory'],defaultPath:store.disk.settings[kind]});return r.canceled?null:r.filePaths[0];});
  ipcMain.handle('companion:settings',(event,next)=>{
    secure(event);const before=store.disk.settings;
    const s={...before,...next};
    for(const key of ['logsPath','screenshotsPath'])if(typeof s[key]!=='string' || !fs.statSync(s[key]).isDirectory())throw Error('目录不存在');
    if(!Number.isInteger(s.interval) || s.interval<1 || s.interval>300)throw Error('截图间隔须为 1～300 秒');
    if(!Number.isInteger(s.opacity) || s.opacity<25 || s.opacity>100)throw Error('不透明度须为 25～100');
    for(const key of ['autoScreenshot','cleanupScreenshots','follow'])if(typeof s[key]!=='boolean')throw Error('开关设置无效');
    if(Object.hasOwn(next,'hotkey'))hotkey(s.hotkey);store.disk.settings=s;overlay.setOpacity(s.opacity/100);configureShot();store.save();
    if(before.logsPath!==s.logsPath || before.screenshotsPath!==s.screenshotsPath)startMonitor();publish();return store.snapshot();
  });
  const {AutoScreenshot}=await import(pathToFileURL(path.join(__dirname,'auto-screenshot.mjs')).href);
  shot=new AutoScreenshot(root,{getContext:()=>({mode:store.runtime.mode,map:store.runtime.raid==='raid'?store.runtime.map:null,profile:store.runtime.profile,selectedProfile:store.disk.selectedProfile}),onState:value=>{store.runtime.capture=value;publish();}});
  configureShot();startMonitor();
  try{hotkey(store.disk.settings.hotkey);}catch(e){store.runtime.hotkeyError=e.message;}
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'任务与地图',submenu:[{label:'实时地图',click:()=>main.loadURL(origin+'/companion-map')},{label:'任务列表 / 任务树（PvE）',click:()=>main.loadURL(origin+'/tasks')},{label:'主线章节',click:()=>main.loadURL(origin+'/storyline')},{label:'本地设置',click:()=>main.loadURL(origin+'/companion-settings')},{type:'separator'},{label:'退出',click:()=>app.quit()}]}]));
  await main.loadURL(origin+(needsSetup()?'/companion-settings':'/companion-map'));await overlay.loadURL(origin+'/companion-map?overlay=1');if(!smokeTest)main.show();
  heartbeat=setInterval(publish,2000);
  if(smokeTest)await require('./smoke.cjs')({main,overlay,store,root,dataDir,origin,app,publish});
 }).catch(error=>{logError(error);if(!smokeTest)dialog.showErrorBox('整合助手启动失败',error.message+'\n详细信息已保存至 data/startup-error.log');app.quit();});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',()=>{quitting=true;clearInterval(heartbeat);clearTimeout(publishTimer);for(const timer of pendingCleanup.values())clearTimeout(timer);shot?.stop();monitor?.kill();server?.kill();store.save();globalShortcut.unregisterAll();});
}
