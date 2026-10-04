import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Overlay,validateOverlaySettings,validateOverlayOpacity} from '../overlay.mjs';
import {clusterPoints,taskLocationPoints} from '../public/map-points.mjs';

test('each task has one marker per floor, anchored at its first remaining goal with every goal retained',()=>{
  const point=(x,layer=0,taskId='luxury')=>({x:x*5,y:10,world:{x,z:0},layer,taskId});
  const points=[point(117),point(130),point(119),point(200),point(119,1),point(119,0,'other')];
  const groups=taskLocationPoints(points);
  assert.equal(groups.length,3);assert.equal(groups[0].points.length,4);
  assert.equal(groups[0].x,585);assert.equal(groups[0].representative,points[0]);
  assert.equal(groups.flatMap(g=>g.points).length,points.length);
});

test('map clusters preserve every location, keep tasks and floors separate, and expand on zoom',()=>{
  const points=[{id:'a',taskId:'quest',layer:0,x:10,y:20},{id:'b',taskId:'quest',layer:0,x:20,y:20},
    {id:'c',taskId:'other',layer:0,x:10,y:20},{id:'d',taskId:'quest',layer:1,x:10,y:20}];
  const groups=clusterPoints(points,1);
  assert.equal(groups.length,3);assert.equal(groups[0].points.length,2);
  assert.equal(groups[0].x,15);assert.equal(groups[0].y,20);
  assert.deepEqual(groups.flatMap(g=>g.points.map(p=>p.id)).sort(),['a','b','c','d']);
  assert.equal(clusterPoints(points,4).length,4);
  assert.equal(groups[1].x,points[2].x);assert.equal(groups[1].y,points[2].y);
});

test('overlay hotkeys normalize modifiers and reject keys that conflict with typing or screenshots',()=>{
  assert.equal(validateOverlaySettings(true,'ctrl+alt+m').overlayHotkey,'Control+Alt+M');
  assert.equal(validateOverlaySettings(false,'F8').overlayHotkeyEnabled,false);
  for(const key of ['Insert','Ctrl+Insert','M','Ctrl+Ctrl+M','F12','Alt+Delete','Win+L',''])assert.throws(()=>validateOverlaySettings(true,key));
  assert.equal(validateOverlaySettings(true,'F8',65).overlayOpacity,65);
  for(const value of [0,24,101,NaN,'50',50.5])assert.throws(()=>validateOverlayOpacity(value));
});

test('overlay controller pairs replies, reports hotkey conflicts, and stops its child',async()=>{
  const child=new EventEmitter();child.stderr=new EventEmitter();child.connected=true;
  child.stderr.setEncoding=()=>{};
  const commands=[],states=[];
  const reply=value=>child.emit('message',value);
  child.send=command=>{
    commands.push(command);
    if(command.action==='quit'){child.exitCode=0;return;}
    queueMicrotask(()=>reply({kind:'reply',id:command.id,...(command.overlayHotkey==='F9'?{error:'快捷键已被占用'}:{state:{ready:true}})}));
  };
  const overlay=new Overlay('',{onState:s=>states.push(s),spawnWorker:()=>{
    queueMicrotask(()=>reply({kind:'ready',state:{ready:true}}));return child;
  }});
  try {
    assert.equal((await overlay.configure(true,'F8')).overlayHotkey,'F8');
    await Promise.all([overlay.command('show'),overlay.command('status')]);
    assert.equal(commands.length,3);assert.equal(new Set(commands.map(c=>c.id)).size,3);
    await assert.rejects(overlay.configure(true,'F9'),/占用/);
    assert.match(states.at(-1).error,/占用/);
    overlay.stop();assert.equal(commands.at(-1).action,'quit');
  }finally{overlay.stop();}
});
