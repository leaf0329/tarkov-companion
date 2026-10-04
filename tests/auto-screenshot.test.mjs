import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AutoScreenshot,validateAutoScreenshot } from '../auto-screenshot.mjs';

test('auto screenshot obeys the interval, PvE profile isolation, result reporting and shutdown',()=>{
  let at=0,context={mode:'regular',map:'海关',profile:'a',selectedProfile:'a'},spawns=0;
  const states=[],commands=[];
  const worker=new EventEmitter();worker.stdout=new EventEmitter();worker.stderr=new EventEmitter();worker.stdin=new EventEmitter();
  worker.stdout.setEncoding=worker.stderr.setEncoding=()=>{};
  worker.stdin.write=text=>commands.push(text);worker.stdin.end=text=>{commands.push(text);worker.exitCode=0;};
  worker.exitCode=null;
  const auto=new AutoScreenshot('',{getContext:()=>context,onState:s=>states.push(s),now:()=>at,spawnWorker:()=>{spawns++;return worker;}});
  try {
    auto.configure(true,5);auto.tick();assert.deepEqual(commands,[]);
    worker.stdout.emit('data','{"kind":"rea');worker.stdout.emit('data','dy"}\n');
    at=4999;auto.tick();assert.deepEqual(commands,[]);
    at=5000;auto.tick();assert.equal(states.at(-1).phase,'paused-context');assert.deepEqual(commands,[]);
    context={...context,mode:'pve',selectedProfile:'other'};at=10000;auto.tick();assert.deepEqual(commands,[]);
    context.selectedProfile='a';at=15000;auto.tick();auto.tick();assert.deepEqual(commands,['press\n']);
    worker.stdout.emit('data','{"kind":"result","phase":"paused-background"}\n');assert.equal(states.at(-1).sentCount,0);
    at=20000;auto.tick();worker.stdout.emit('data','{"kind":"result","phase":"sent"}\n');
    assert.equal(states.at(-1).lastPressAt,20000);assert.equal(states.at(-1).sentCount,1);
    auto.configure(true,2);assert.equal(spawns,1);at=21999;auto.tick();assert.equal(commands.length,2);
    at=22000;auto.tick();assert.equal(commands.length,3);
    auto.configure(false,2);assert.equal(commands.at(-1),'stop\n');assert.equal(states.at(-1).phase,'off');
    worker.stdout.emit('data','{"kind":"result","phase":"sent"}\n');assert.equal(states.at(-1).sentCount,1);
    at=30000;auto.tick();assert.equal(commands.length,4);
  }finally{auto.stop();}
});

test('auto screenshot rejects invalid intervals and enabled values',()=>{
  for(const seconds of [0,-1,0.5,301,NaN,'5'])assert.throws(()=>validateAutoScreenshot(true,seconds));
  assert.throws(()=>validateAutoScreenshot('true',5));
  assert.equal(validateAutoScreenshot(false,300).autoScreenshotInterval,300);
});

test('Windows helper compiles, uses the correct native INPUT size, and maps Insert without sending input',{skip:process.platform!=='win32'},async()=>{
  const script=fileURLToPath(new URL('../scripts/screenshot-key.ps1',import.meta.url));
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-SelfTest'],{windowsHide:true});
  let output='',errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  assert.equal(code,0,errors);const result=JSON.parse(output.trim());
  assert.equal(result.inputSize,process.arch==='x64'?40:28);assert.equal(result.insertScan & 0xff,0x52);
});
