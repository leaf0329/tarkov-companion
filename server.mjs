import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScreenshot } from './public/coordinates.mjs';
import { loadCatalog } from './catalog.mjs';
import { LogReader } from './logs.mjs';
import { AutoScreenshot,validateAutoScreenshot } from './auto-screenshot.mjs';
import { Overlay,validateOverlaySettings,validateOverlayOpacity } from './overlay.mjs';
import {ScreenshotCleanup} from './screenshot-cleanup.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.TARKOV_PORT || 18765);
const publicDir=path.join(root,'public'),statePath=process.env.TARKOV_STATE_PATH || path.join(root,'data/state.json');
const catalog=loadCatalog(root),known=new Set(catalog.tasks.flatMap(q=>[q.id,...(q.story?.groups || [])]));
const objectiveIds=new Set(catalog.tasks.flatMap(q=>[...q.objectives.map(o=>o.id),...(q.story?.guide || []).map(o=>o.id)]));
const defaults={logsPath:process.env.TARKOV_LOGS_PATH || 'E:/SteamLibrary/steamapps/common/Escape from Tarkov/build/Logs',screenshotsPath:process.env.TARKOV_SCREENSHOTS_PATH || path.join(process.env.USERPROFILE || '', 'Documents/Escape from Tarkov/Screenshots'),autoScreenshotEnabled:false,autoScreenshotInterval:5,overlayHotkeyEnabled:true,overlayHotkey:'F8'};
let disk={settings:defaults,profiles:{},selectedProfile:null};
if(fs.existsSync(statePath)) disk={...disk,...JSON.parse(fs.readFileSync(statePath,'utf8'))};
disk.settings={...defaults,...disk.settings};
disk.settings.followPlayer ??= true;
disk.settings.overlayOpacity ??= 100;
disk.settings.screenshotCleanupEnabled ??= true;
try{validateAutoScreenshot(disk.settings.autoScreenshotEnabled,disk.settings.autoScreenshotInterval);}catch{disk.settings.autoScreenshotEnabled=false;disk.settings.autoScreenshotInterval=5;}
try{Object.assign(disk.settings,validateOverlaySettings(disk.settings.overlayHotkeyEnabled,disk.settings.overlayHotkey,disk.settings.overlayOpacity));}catch{disk.settings.overlayHotkeyEnabled=true;disk.settings.overlayHotkey='F8';disk.settings.overlayOpacity=100;}
let runtime={map:null,mapAt:0,scene:null,position:null,mode:null,profile:null,raid:'等待战局',logStatus:'正在扫描',logFiles:0,unknownTasks:0,events:[],lastLogAt:null};
let reader,dirty=false;
for(const p of Object.values(disk.profiles))for(const [id,entry] of Object.entries(p.tasks || {})) {
  if(entry.source==='toolbox'){delete p.tasks[id];dirty=true;}
}
if('baselineImported' in disk){delete disk.baselineImported;dirty=true;}

const clients=new Set();
function profile(id) {return disk.profiles[id] ||= {tasks:{},objectives:{},label:`PvE · ${id.slice(-8)}`};}
function persist() {
  if(!dirty)return;
  fs.writeFileSync(statePath+'.tmp',JSON.stringify(disk,null,2));fs.renameSync(statePath+'.tmp',statePath);dirty=false;
}
function state() {return {settings:disk.settings,profiles:Object.entries(disk.profiles).map(([id,p])=>({id,label:p.label})),selectedProfile:disk.selectedProfile,
  progress:disk.selectedProfile?profile(disk.selectedProfile).tasks:{},objectives:disk.selectedProfile?profile(disk.selectedProfile).objectives:{},runtime};}
function broadcast() {const text=`data: ${JSON.stringify(state())}\n\n`;for(const res of clients)res.write(text);}
const autoScreenshot=new AutoScreenshot(root,{getContext:()=>({mode:runtime.mode,map:runtime.map,profile:runtime.profile,selectedProfile:disk.selectedProfile}),onState:value=>{runtime.autoScreenshot=value;broadcast();}});
const overlayEnabled=process.platform==='win32' && process.env.TARKOV_OVERLAY_DISABLED!=='1';
const overlay=new Overlay(root,{port,onState:value=>{runtime.overlay=value;broadcast();}});
runtime.overlay={...overlay.value,available:overlayEnabled};
function addEvent(text,at=Date.now()) {runtime.events.unshift({text,at});runtime.events=runtime.events.slice(0,80);}
function consume(events) {
  let changed=false;
  for(const e of events) {
    if(e.at>=(runtime.lastLogAt || 0)) {
      runtime.lastLogAt=e.at;
      if(e.kind==='mode'){runtime.mode=e.value;runtime.gameVersion=e.version;}
      if(e.kind==='profile')runtime.profile=e.profile;
    }
    if(e.mode!=='pve' || !e.profile)continue;
    if(e.kind==='profile' && e.at >= (runtime.profileAt || 0)) {
      runtime.profileAt=e.at;runtime.profile=e.profile;
      profile(e.profile);
      if(!disk.selectedProfile)disk.selectedProfile=e.profile;
      changed=true;
    }
    if(e.kind==='map' && e.at>=runtime.mapAt) {
      runtime.map=e.value;runtime.scene=e.scene;runtime.mapAt=e.at;runtime.position=null;runtime.raid=e.historical?'上次战局地图':'地图加载中';changed=true;
    }
    if(e.kind==='raid' && e.at>=runtime.mapAt) {runtime.raid=e.value;if(e.value==='大厅')runtime.position=null;changed=true;}
    if(e.kind==='quest') {
      const p=profile(e.profile),old=p.tasks[e.id];
      if(!old || e.at>old.at) {
        p.tasks[e.id]={status:e.status,at:e.at,source:'log'};dirty=true;changed=true;
        if(!known.has(e.id))runtime.unknownTasks++;
        const q=catalog.tasks.find(q=>q.id===e.id || q.story?.groups.includes(e.id));
        addEvent(`${{active:'接取',failed:'失败',completed:'完成'}[e.status]} · ${q?.name || e.id}`,e.at);
      }
    }
  }
  if(changed){dirty=true;broadcast();}
}
function setupReader() {
  runtime.position=null;
  reader=new LogReader(disk.settings.logsPath,consume,message=>{runtime.logStatus=message;});
  reader.history();runtime.logFiles=reader.cursors.size;
  if(!disk.selectedProfile && runtime.profile && runtime.mode==='pve'){disk.selectedProfile=runtime.profile;dirty=true;}
  broadcast();persist();
}
let screenshotsSeen=new Map(),screenshotWatcher=null;
const screenshotCleanup=new ScreenshotCleanup();
function acceptScreenshot(filename,at) {
  const position=parseScreenshot(filename);
  if(!position || at<runtime.mapAt || !runtime.map || runtime.mode!=='pve' || runtime.profile!==disk.selectedProfile)return;
  if(runtime.position && at<=runtime.position.at)return;
  runtime.position={...position,at,map:runtime.map,filename};broadcast();
}
function setupScreenshotWatcher() {
  screenshotWatcher?.close();screenshotWatcher=null;
  try {
    // libuv on Windows can abort on 8.3 aliases when directory events use long paths.
    screenshotWatcher=fs.watch(path.normalize(fs.realpathSync.native(disk.settings.screenshotsPath)),(_event,name)=>{
      if(!name)return;
      const filename=name.toString();if(!parseScreenshot(filename))return;
      let at;
      try {at=fs.statSync(path.join(disk.settings.screenshotsPath,filename)).mtimeMs;}
      catch {
        // Other installed companions may remove screenshots before this callback runs.
        if(screenshotsSeen.has(filename))return;
        const time=filename.match(/^(\d{4}-\d{2}-\d{2})\[(\d{2})-(\d{2})/);
        const captured=time?Date.parse(`${time[1]}T${time[2]}:${time[3]}:00+08:00`):0;
        if(Date.now()-captured<0 || Date.now()-captured>120000)return;
        at=Date.now();
      }
      if(screenshotsSeen.get(filename)===at)return;
      screenshotsSeen.set(filename,at);acceptScreenshot(filename,at);
    });
    screenshotWatcher.on('error',e=>{runtime.screenshotStatus='截图监听错误：'+e.code;broadcast();});
  }catch(e){runtime.screenshotStatus='截图目录不可读：'+e.code;}
}
function screenshotPoll() {
  try {
    const dir=disk.settings.screenshotsPath;
    const files=fs.readdirSync(dir).filter(n=>/\.png$/i.test(n));
    const fresh=[];
    for(const filename of files) {
      const stat=fs.statSync(path.join(dir,filename));
      if(screenshotsSeen.get(filename)===stat.mtimeMs)continue;
      screenshotsSeen.set(filename,stat.mtimeMs);
      const position=parseScreenshot(filename);
      if(position && stat.mtimeMs>=runtime.mapAt && runtime.map && runtime.mode==='pve' && runtime.profile===disk.selectedProfile) fresh.push({...position,at:stat.mtimeMs,map:runtime.map,filename});
    }
    if(fresh.length){const latest=fresh.sort((a,b)=>b.at-a.at)[0];acceptScreenshot(latest.filename,latest.at);}
    screenshotCleanup.scan(dir,disk.settings.screenshotCleanupEnabled);
    const present=new Set(files);
    for(const [name,at] of screenshotsSeen)if(!present.has(name) && Date.now()-at>120000)screenshotsSeen.delete(name);
    runtime.screenshotCleanup={enabled:disk.settings.screenshotCleanupEnabled,deleted:screenshotCleanup.deleted,error:screenshotCleanup.error};
    runtime.screenshotStatus='截图目录已连接';
  }catch(e){runtime.screenshotStatus='截图目录不可读：'+e.code;}
}
setupReader();screenshotPoll();setupScreenshotWatcher();
autoScreenshot.configure(disk.settings.autoScreenshotEnabled,disk.settings.autoScreenshotInterval);
const pollTimer=setInterval(()=>{try{reader.poll();runtime.logFiles=reader.cursors.size;screenshotPoll();persist();}catch(e){runtime.logStatus=e.message;broadcast();}},1000);
const heartbeatTimer=setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n');},15000);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
function json(res,body,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req) {let text='';for await(const chunk of req){text+=chunk;if(text.length>2*1024*1024)throw new Error('请求过大');}return JSON.parse(text || '{}');}
const server=http.createServer(async(req,res)=>{
  try {
    const expected=`127.0.0.1:${port}`;
    if(req.headers.host!==expected && req.headers.host!==`localhost:${port}`)return json(res,{error:'仅接受本机请求'},403);
    const url=new URL(req.url,`http://${expected}`);
    if(req.method==='GET' && url.pathname==='/api/catalog')return json(res,{tasks:catalog.tasks,maps:catalog.maps,traders:catalog.traders,source:catalog.source});
    if(req.method==='GET' && url.pathname==='/api/state')return json(res,state());
    if(req.method==='GET' && url.pathname==='/api/events') {
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});clients.add(res);
      res.write(`data: ${JSON.stringify(state())}\n\n`);req.on('close',()=>clients.delete(res));return;
    }
    if(req.method==='POST') {
      const origin=req.headers.origin;
      if(req.headers['x-tarkov-local']!=='1' || (origin!==`http://${expected}` && origin!==`http://localhost:${port}`))return json(res,{error:'请求来源无效'},403);
      const b=await body(req);
      if(url.pathname==='/api/choose-directory') {
        if(!['logsPath','screenshotsPath'].includes(b.kind))throw new Error('目录类型无效');
        if(!overlayEnabled)throw new Error('目录选择需要 Windows 桌面组件');
        return json(res,await overlay.command('choose-directory',{title:b.kind==='logsPath'?'选择游戏 Logs 文件夹':'选择游戏 Screenshots 文件夹',defaultPath:disk.settings[b.kind]}));
      }
      if(url.pathname==='/api/progress') {
        if(!disk.selectedProfile)throw new Error('还未识别到 PvE 角色，请先连接正确日志目录');
        if(!known.has(b.id) || !['active','completed','failed','unknown','ready'].includes(b.status))throw new Error('任务状态无效');
        const p=profile(disk.selectedProfile),previous=p.tasks[b.id] || null;
        p.tasks[b.id]={status:b.status,at:Date.now(),source:'manual'};
        disk.undo={profile:disk.selectedProfile,id:b.id,previous,at:p.tasks[b.id].at};dirty=true;
      }else if(url.pathname==='/api/undo') {
        const u=disk.undo;if(!u)throw new Error('没有可撤销的手动修改');
        const p=profile(u.profile);
        if(p.tasks[u.id]?.source!=='manual' || p.tasks[u.id]?.at!==u.at)throw new Error('该任务已被新日志更新，不能撤销旧的手动记录');
        if(u.previous)p.tasks[u.id]=u.previous;else delete p.tasks[u.id];disk.undo=null;dirty=true;
      }else if(url.pathname==='/api/objective') {
        if(!disk.selectedProfile)throw new Error('还未识别到 PvE 角色');
        if(!objectiveIds.has(b.id))throw new Error('目标无效');
        profile(disk.selectedProfile).objectives[b.id]=!!b.done;dirty=true;
      }else if(url.pathname==='/api/map-settings') {
        if(typeof b.followPlayer!=='boolean')throw new Error('跟随位置开关无效');
        disk.settings.followPlayer=b.followPlayer;dirty=true;
      }else if(url.pathname==='/api/auto-screenshot') {
        const settings=validateAutoScreenshot(b.enabled,b.intervalSeconds);
        disk.settings={...disk.settings,...settings};dirty=true;
        autoScreenshot.configure(b.enabled,b.intervalSeconds);
      }else if(url.pathname==='/api/screenshot-cleanup') {
        if(typeof b.enabled!=='boolean')throw new Error('截图清理开关无效');
        disk.settings.screenshotCleanupEnabled=b.enabled;dirty=true;screenshotPoll();
      }else if(url.pathname==='/api/overlay-settings') {
        validateOverlaySettings(b.enabled,b.hotkey,b.opacity ?? disk.settings.overlayOpacity);
        if(!overlayEnabled)throw new Error('当前环境未启用 Windows 置顶浮窗');
        const settings=await overlay.configure(b.enabled,b.hotkey,b.opacity ?? disk.settings.overlayOpacity);
        disk.settings={...disk.settings,...settings};dirty=true;
      }else if(url.pathname==='/api/overlay-opacity') {
        const opacity=validateOverlayOpacity(b.opacity);
        if(!overlayEnabled)throw new Error('当前环境未启用 Windows 置顶浮窗');
        await overlay.command('opacity',{opacity});disk.settings.overlayOpacity=opacity;dirty=true;
      }else if(url.pathname==='/api/overlay') {
        if(!['show','hide','toggle','status'].includes(b.action))throw new Error('浮窗操作无效');
        if(!overlayEnabled)throw new Error('当前环境未启用 Windows 置顶浮窗');
        if(!overlay.value.ready)await overlay.configure(disk.settings.overlayHotkeyEnabled,disk.settings.overlayHotkey,disk.settings.overlayOpacity);
        await overlay.command(b.action);
      }else if(url.pathname==='/api/settings') {
        for(const key of ['logsPath','screenshotsPath']) {
          if(typeof b[key]!=='string' || !fs.existsSync(b[key]) || !fs.statSync(b[key]).isDirectory())throw new Error(`${key==='logsPath'?'日志':'截图'}目录不存在`);
        }
        const next={...disk.settings,logsPath:path.resolve(b.logsPath),screenshotsPath:path.resolve(b.screenshotsPath)};
        if(b.autoScreenshotEnabled!==undefined)Object.assign(next,validateAutoScreenshot(b.autoScreenshotEnabled,b.autoScreenshotInterval));
        if(b.screenshotCleanupEnabled!==undefined){if(typeof b.screenshotCleanupEnabled!=='boolean')throw new Error('截图清理开关无效');next.screenshotCleanupEnabled=b.screenshotCleanupEnabled;}
        const overlayConfig=validateOverlaySettings(b.overlayHotkeyEnabled ?? next.overlayHotkeyEnabled,b.overlayHotkey ?? next.overlayHotkey,b.overlayOpacity ?? next.overlayOpacity);
        Object.assign(next,overlayConfig);
        if(b.profileId && !disk.profiles[b.profileId])throw new Error('角色无效');
        if(overlayEnabled)await overlay.configure(next.overlayHotkeyEnabled,next.overlayHotkey,next.overlayOpacity);
        const pathsChanged=next.logsPath!==disk.settings.logsPath || next.screenshotsPath!==disk.settings.screenshotsPath;
        const captureChanged=next.autoScreenshotEnabled!==disk.settings.autoScreenshotEnabled || next.autoScreenshotInterval!==disk.settings.autoScreenshotInterval;
        disk.settings=next;dirty=true;
        if(b.profileId && b.profileId!==disk.selectedProfile){disk.selectedProfile=b.profileId;runtime.position=null;}
        if(pathsChanged){screenshotsSeen=new Map();setupReader();setupScreenshotWatcher();}
        if(captureChanged)autoScreenshot.configure(next.autoScreenshotEnabled,next.autoScreenshotInterval);
        screenshotPoll();
      }else if(url.pathname==='/api/profile') {
        if(!disk.profiles[b.id])throw new Error('角色无效');disk.selectedProfile=b.id;runtime.position=null;dirty=true;
      }else if(url.pathname==='/api/replay') {setupReader();}
      else return json(res,{error:'未知操作'},404);
      persist();broadcast();return json(res,{ok:true});
    }
    if(req.method!=='GET')return json(res,{error:'方法不支持'},405);
    let filename;
    if(url.pathname==='/vendor/dagre.js')filename=path.join(root,'node_modules/@dagrejs/dagre/dist/dagre.min.js');
    else {
      const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');
      filename=path.resolve(publicDir,relative || 'index.html');
      if(!filename.startsWith(publicDir+path.sep))return json(res,{error:'路径无效'},403);
    }
    if(!fs.existsSync(filename) || !fs.statSync(filename).isFile())return json(res,{error:'文件不存在'},404);
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(filename).pipe(res);
  }catch(e){json(res,{error:e.message},400);}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'助手端口已占用，请打开已有助手窗口。':e);process.exit(1);});
server.listen(port,'127.0.0.1',()=>{
  console.log(`塔科夫个人助手：http://127.0.0.1:${port} · ${catalog.tasks.length} 个任务 · ${catalog.maps.length} 张地图`);
  if(overlayEnabled)overlay.configure(disk.settings.overlayHotkeyEnabled,disk.settings.overlayHotkey,disk.settings.overlayOpacity).catch(e=>console.error('置顶浮窗：'+e.message));
});
export function shutdown(){clearInterval(pollTimer);clearInterval(heartbeatTimer);screenshotWatcher?.close();autoScreenshot.stop();overlay.stop();persist();for(const res of clients)res.end();server.close();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{shutdown();process.exit();});
