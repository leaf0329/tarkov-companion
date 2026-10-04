import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('local service tracks live events and screenshots, saves manual state, and rejects outside mutations',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tarkov-integration-')),logs=path.join(temp,'Logs'),shots=path.join(temp,'Screenshots');
  const folder=path.join(logs,'log_2026.10.03_12-00-00_test');fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(shots);
  const stamp=at=>new Date(at).toISOString().replace('T',' ').replace('Z',' +00:00');
  const now=Date.now()-5000;
  const line=(at,text)=>`${stamp(at)}|1.1.5.1.47510|Info|application|${text}\n`;
  const id='5936d90786f7742b1420ba5b',pid='aaaaaaaaaaaaaaaaaaaaaaaa';
  const notif=(at,type)=>line(at,'Got notification | ChatMessageReceived')+JSON.stringify({message:{type,templateId:id+' description'}},null,2)+'\n';
  fs.writeFileSync(path.join(folder,'application_000.log'),line(now,'Session mode: Pve')+line(now+100,`SelectedProfile ProfileId:${pid} AccountId:1`)+line(now+200,'scene preset path:maps/customs_preset.bundle'));
  const push=path.join(folder,'push-notifications_000.log');fs.writeFileSync(push,notif(now+300,10));
  const port=18866,base=`http://127.0.0.1:${port}`;
  let child;
  const env={...process.env,TARKOV_OVERLAY_DISABLED:'1',TARKOV_INPUT_DRY_RUN:'1',TARKOV_PORT:String(port),TARKOV_STATE_PATH:path.join(temp,'state.json'),TARKOV_LOGS_PATH:logs,TARKOV_SCREENSHOTS_PATH:shots};
  fs.writeFileSync(env.TARKOV_STATE_PATH,JSON.stringify({settings:{},selectedProfile:pid,baselineImported:true,profiles:{[pid]:{label:'测试角色',objectives:{},tasks:{[id]:{status:'completed',source:'toolbox',at:Date.now()+100000},'ffffffffffffffffffffffff':{status:'active',source:'toolbox',at:now}}}}}));
  async function start() {
    child=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:['ignore','ignore','inherit']});
    for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/state');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}
    throw new Error('测试服务启动超时');
  }
  async function stop(){const exit=once(child,'exit');child.kill();await exit;}
  const get=()=>fetch(base+'/api/state').then(r=>r.json());
  const post=(endpoint,b)=>fetch(base+'/api/'+endpoint,{method:'POST',headers:{Origin:base,'X-Tarkov-Local':'1','Content-Type':'application/json'},body:JSON.stringify(b)});
  async function until(predicate){for(let i=0;i<60;i++){const s=await get();if(predicate(s))return s;await new Promise(r=>setTimeout(r,100));}throw new Error('未观察到实时更新');}
  try {
    await start();let s=await get();assert.equal(s.progress[id].status,'active');assert.equal(s.runtime.map,'海关');
    assert.equal(s.progress[id].source,'log');assert.equal(Object.keys(s.progress).length,1);
    assert.equal(s.settings.autoScreenshotInterval,5);assert.equal(s.runtime.autoScreenshot.enabled,false);
    assert.equal((await post('auto-screenshot',{enabled:true,intervalSeconds:0})).status,400);
    assert.equal((await post('auto-screenshot',{enabled:false,intervalSeconds:9})).status,200);
    assert.equal((await post('settings',{logsPath:logs,screenshotsPath:shots})).status,200);
    assert.equal((await get()).settings.autoScreenshotInterval,9);
    assert.equal((await post('map-settings',{followPlayer:'false'})).status,400);
    assert.equal((await post('map-settings',{followPlayer:false})).status,200);
    assert.equal((await get()).settings.followPlayer,false);
    fs.appendFileSync(push,notif(now+400,12));await until(s=>s.progress[id].status==='completed');
    const localDate=new Date(Date.now()+8*3600*1000).toISOString();
    const filename=localDate.slice(0,10)+'['+localDate.slice(11,16).replace(':','-')+']_102.30, 2.96, -5.91_0.0, 0.0, 0.0, 1.0 (0).png';
    const screenshot=path.join(shots,filename);fs.writeFileSync(screenshot,'');fs.unlinkSync(screenshot);
    s=await until(s=>s.runtime.position?.x===102.3);assert.equal(s.runtime.position.map,'海关');
    const nextName=filename.replace('102.30','103.30'),nextShot=path.join(shots,nextName);
    fs.writeFileSync(nextShot,'test screenshot');fs.writeFileSync(path.join(shots,'Windows Screenshot.png'),'keep');
    s=await until(s=>s.runtime.position?.x===103.3);
    s=await until(s=>s.runtime.screenshotCleanup?.deleted===1);
    assert.ok(!fs.existsSync(nextShot));assert.equal(s.runtime.position.x,103.3);
    assert.ok(fs.existsSync(path.join(shots,'Windows Screenshot.png')));
    assert.equal((await post('screenshot-cleanup',{enabled:'yes'})).status,400);
    assert.equal((await post('screenshot-cleanup',{enabled:false})).status,200);
    const rejected=await fetch(base+'/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:'failed'})});assert.equal(rejected.status,403);
    assert.equal((await post('progress',{id,status:'ready'})).status,200);assert.equal((await get()).progress[id].status,'ready');
    await stop();await start();assert.equal((await get()).progress[id].status,'ready');assert.equal((await get()).settings.autoScreenshotInterval,9);
    assert.equal((await get()).settings.screenshotCleanupEnabled,false);
    assert.equal((await get()).settings.followPlayer,false);
    assert.equal((await post('undo',{})).status,200);assert.equal((await get()).progress[id].status,'completed');
    fs.appendFileSync(path.join(folder,'application_000.log'),line(Date.now(),'Session mode: Regular')+line(Date.now()+1,'SelectedProfile ProfileId:bbbbbbbbbbbbbbbbbbbbbbbb AccountId:1'));
    fs.appendFileSync(push,notif(Date.now()+2,11));await until(s=>s.runtime.mode==='regular');
    assert.equal((await get()).progress[id].status,'completed');
    const catalog=await fetch(base+'/api/catalog').then(r=>r.json());
    const story=catalog.tasks.find(q=>q.story),step=story.story.groups[0],guide=story.story.guide.find(g=>!g.objectiveId).id;
    assert.equal((await post('progress',{id:step,status:'active'})).status,200);
    assert.equal((await post('objective',{id:guide,done:true})).status,200);
    assert.equal((await post('progress',{id:'wiki:to-the-light-false-call',status:'active'})).status,200);
    assert.equal((await post('objective',{id:'guide:made-up',done:true})).status,400);
    s=await get();assert.equal(s.progress[step].status,'active');assert.equal(s.objectives[guide],true);assert.equal(s.progress[story.id],undefined);
    const allSettings={logsPath:logs,screenshotsPath:shots,autoScreenshotEnabled:false,autoScreenshotInterval:21,screenshotCleanupEnabled:false,overlayHotkeyEnabled:false,overlayHotkey:'F10',overlayOpacity:65,profileId:pid};
    const previousSettings=(await get()).settings;
    assert.equal((await post('settings',{...allSettings,overlayOpacity:0})).status,400);
    assert.deepEqual((await get()).settings,previousSettings);
    assert.equal((await post('settings',{...allSettings,profileId:'invalid'})).status,400);
    assert.deepEqual((await get()).settings,previousSettings);
    assert.equal((await post('settings',allSettings)).status,200);
    s=await get();assert.equal(s.settings.autoScreenshotInterval,21);assert.equal(s.settings.overlayOpacity,65);assert.equal(s.settings.overlayHotkey,'F10');assert.equal(s.settings.overlayHotkeyEnabled,false);
    await stop();await start();s=await get();assert.equal(s.settings.overlayOpacity,65);assert.equal(s.settings.autoScreenshotInterval,21);
  }finally{if(child && child.exitCode===null)await stop();fs.rmSync(temp,{recursive:true,force:true});}
});
