import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LogParser,LogReader,mapForScene } from '../logs.mjs';
import { parseScreenshot,buildProjection,selectCalibratedLayer } from '../public/coordinates.mjs';
import { loadCatalog } from '../catalog.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const header=(time,text)=>`2026-10-03 ${time}.000|1.1.5.1.47510|Info|application|${text}\n`;
const notification=(time,id,type)=>header(time,'Got notification | ChatMessageReceived')+JSON.stringify({type:'ChatMessageReceived',message:{type,templateId:id+' description'}},null,2)+'\n';
test('official task events parse multiline JSON and ignore chat and malformed IDs',()=>{
  const events=[],parser=new LogParser(e=>events.push(e));
  const id='5936d90786f7742b1420ba5b';
  for(const type of [10,11,12,1])for(const line of notification('12:00:00',id,type).trimEnd().split('\n'))parser.line(line);
  for(const line of notification('12:00:01','invalid',12).trimEnd().split('\n'))parser.line(line);
  assert.deepEqual(events.map(e=>e.status),['active','failed','completed']);
});
test('log replay and append handle mode isolation, partial UTF-8, truncation and a new session',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tarkov-tests-'));
  try {
    const folder=path.join(temp,'log_2026.10.03_12-00-00_1.1');fs.mkdirSync(folder);
    const app=path.join(folder,'application_000.log'),push=path.join(folder,'push-notifications_000.log');
    const profile='aaaaaaaaaaaaaaaaaaaaaaaa',id='5936d90786f7742b1420ba5b',events=[];
    fs.writeFileSync(app,header('12:00:00','Session mode: Pve')+header('12:00:01',`SelectedProfile ProfileId:${profile} AccountId:1`));
    fs.writeFileSync(push,notification('12:00:02',id,10));
    const r=new LogReader(temp,b=>events.push(...b),()=>{});r.history();
    assert.equal(events.find(e=>e.kind==='quest').profile,profile);
    const record=Buffer.from(notification('12:00:03',id,12).replace('description','完成'));
    const cut=record.indexOf(Buffer.from('完成'))+1;
    fs.appendFileSync(push,record.subarray(0,cut));r.poll();
    assert.equal(events.filter(e=>e.kind==='quest').length,1);
    fs.appendFileSync(push,record.subarray(cut));r.poll();
    assert.equal(events.filter(e=>e.kind==='quest').at(-1).status,'completed');
    fs.appendFileSync(app,header('12:00:04','Session mode: Regular')+header('12:00:05',`SelectedProfile ProfileId:bbbbbbbbbbbbbbbbbbbbbbbb AccountId:1`));
    fs.appendFileSync(push,notification('12:00:06',id,10));r.poll();
    assert.equal(events.filter(e=>e.kind==='quest').at(-1).mode,'regular');
    fs.writeFileSync(push,notification('12:00:07',id,11));r.poll();
    assert.equal(events.filter(e=>e.kind==='quest').at(-1).status,'failed');
    const other=path.join(temp,'log_2026.10.03_13-00-00_1.1');fs.mkdirSync(other);
    fs.writeFileSync(path.join(other,'application_000.log'),header('13:00:00','Session mode: Pve')+header('13:00:01',`SelectedProfile ProfileId:${profile} AccountId:1`));
    fs.writeFileSync(path.join(other,'notifications_000.log'),notification('13:00:02',id,10));r.poll();
    assert.equal(events.filter(e=>e.kind==='quest').at(-1).mode,'pve');
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('screenshot coordinates and quaternion heading parse the game filename only',()=>{
  const p=parseScreenshot('2026-10-03[17-35]_102.30, 2.96, -5.91_0.0, 0.7071, 0.0, 0.7071 (0).png');
  assert.equal(p.x,102.3);assert.equal(p.z,-5.91);assert.ok(Math.abs(p.yaw-90)<.01);
  assert.equal(parseScreenshot('Steam screenshot.png'),null);
  assert.equal(mapForScene('sandbox_start_preset'),'中心区');assert.equal(mapForScene('shopping_mall'),'立交桥');
});

test('floor selection favors calibrated regional insets and never invents a floor',()=>{
  const base={enabled:true,min:0,max:10,matrix:[1,0,0,0,1,0],includes:[],excludes:[]};
  const layers=[{...base,index:0},{...base,index:1,matrix:[1,0,100,0,1,100],includes:[[100,100,20,20]]}];
  assert.equal(selectCalibratedLayer(layers,{x:5,y:5,z:5}),1);
  assert.equal(selectCalibratedLayer(layers,{x:50,y:5,z:50}),0);
  assert.equal(selectCalibratedLayer(layers,{x:5,y:20,z:5}),null);
  assert.equal(selectCalibratedLayer([{...base,index:0,matrix:null}],{x:5,y:5,z:5}),null);
  assert.equal(selectCalibratedLayer([{...layers[1],excludes:[[100,100,20,20]]}],{x:5,y:5,z:5}),null);
  const catalog=loadCatalog(root),labs=catalog.maps.find(m=>m.name==='实验室');
  for(const [height,layer] of [[-2,0],[1,1],[5,2]])assert.equal(selectCalibratedLayer(labs.layers,{x:0,y:height,z:0}),layer);
  const interchange=catalog.maps.find(m=>m.name==='立交桥'),garage=interchange.layers[3];
  const point=garage.tps.game_points.find(p=>selectCalibratedLayer(interchange.layers,{x:p[0],y:20,z:p[1]})===3);
  assert.ok(point,'a calibrated garage point chooses the inset rather than the full map');
});
test('every imported nonlinear map calibration reproduces its control points',()=>{
  const catalog=loadCatalog(root);
  for(const m of catalog.maps)for(const l of m.layers) {
    const project=buildProjection(l);
    if(!l.matrix && !l.tps?.game_points?.length){assert.equal(project,null);continue;}
    assert.ok(project,`${m.name}/${l.name}`);
    if(l.tps)for(let i=0;i<l.tps.game_points.length;i++) {
      const p=project(...l.tps.game_points[i]),expected=l.tps.img_points[i];
      assert.ok(Math.hypot(p[0]-expected[0],p[1]-expected[1])<.01,`${m.name}/${l.name} control ${i}`);
    }
  }
  assert.equal(catalog.tasks.filter(q=>q.kind==='trader').length,512);assert.ok(catalog.tasks.every(q=>q.detailSource==='current' || q.reference?.manualOnly));
  assert.equal(catalog.baseline,undefined);assert.ok(catalog.maps.every(m=>m.points.length===0));
  assert.ok(catalog.tasks.some(q=>q.traderRequirements.some(r=>r.requirementType==='level' && r.value===4)));
});
