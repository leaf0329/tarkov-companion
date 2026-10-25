const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
async function attempt(context){
 const {AutoScreenshot}=await import('../desktop/auto-screenshot.mjs');
 const writes=[],states=[];let now=0;
 const stream=()=>Object.assign(new EventEmitter(),{setEncoding(){}});
 const child=Object.assign(new EventEmitter(),{stdout:stream(),stderr:stream(),stdin:Object.assign(stream(),{write:value=>writes.push(value),end(){}}),exitCode:0});
 const capture=new AutoScreenshot('.', {getContext:()=>context,onState:state=>states.push(state),now:()=>now,spawnWorker:()=>child});
 capture.configure(true,1);child.stdout.emit('data',JSON.stringify({kind:'ready'})+'\n');now=1000;capture.tick();
 const result={writes,phase:states.at(-1).phase};capture.stop();return result;
}
test('PvP automatic screenshots work with an unrelated or blank saved PvE profile',async()=>{
 for(const selectedProfile of ['pve-a',''])assert.deepEqual((await attempt({mode:'pvp',profile:'pvp-b',selectedProfile,map:'interchange'})).writes,['press\n']);
 assert.deepEqual((await attempt({mode:'pvp-season',profile:'season-a',selectedProfile:'pve-a',map:'customs'})).writes,['press\n']);
});
test('PvE automatic screenshots still require the selected PvE character',async()=>{
 assert.deepEqual((await attempt({mode:'pve',profile:'pve-a',selectedProfile:'pve-a',map:'customs'})).writes,['press\n']);
 const mismatch=await attempt({mode:'pve',profile:'other-pve',selectedProfile:'pve-a',map:'customs'});
 assert.deepEqual(mismatch.writes,[]);assert.equal(mismatch.phase,'paused-context');
});
test('lobby, missing character and unsupported mode contexts do not send screenshots',async()=>{
 for(const context of [{mode:'pvp',profile:'pvp-b',map:null},{mode:'pvp',profile:'',map:'interchange'},{mode:'unknown',profile:'other',map:'customs'}]){
  const result=await attempt(context);assert.deepEqual(result.writes,[]);assert.equal(result.phase,'paused-context');
 }
});
