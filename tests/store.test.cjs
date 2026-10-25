const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {LocalStore}=require('../desktop/store.cjs');
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'integrated-store-'));const data=path.join(root,'data');fs.mkdirSync(data);fs.writeFileSync(path.join(data,'companion.json'),JSON.stringify({settings:{},selectedProfile:'pve-a',profiles:{'pve-a':{tasks:{},objectives:{}}}}));const store=new LocalStore(root);store.event({kind:'profile',profile:'pve-a',mode:'pve'});return store;}
test('history cannot overwrite a newer manual state, and fresh events remain scoped to their profile',()=>{
 const s=fixture(),id='5936d90786f7742b1420ba5b';
 s.profile().tasks[id]={status:'active',at:200,source:'manual'};
 s.event({kind:'quest',id,profile:'pve-a',status:'failed',at:100,history:true});assert.equal(s.snapshot().progress[id].status,'active');
 s.event({kind:'quest',id,profile:'pve-b',status:'completed',at:300});assert.equal(s.snapshot().progress[id].status,'active');
 s.event({kind:'quest',id,profile:'pve-a',status:'completed',at:300});assert.equal(s.snapshot().progress[id].status,'completed');
 assert.equal(new LocalStore(s.root).snapshot().progress[id].status,'completed');
});
test('an old renderer cannot write another profile and lobby clears stale player coordinates',()=>{
 const s=fixture();assert.throws(()=>s.saveUI({profile:'pve-b',state:{pve:{}}}),/角色/);
 s.event({kind:'position',mode:'pve',profile:'pve-a',map:'customs',x:10,z:20,at:300});assert.equal(s.runtime.raid,'raid');
 s.event({kind:'raid',value:'lobby',history:false});assert.equal(s.runtime.position,null);
 s.event({kind:'raid',value:'raid',history:true});assert.equal(s.runtime.raid,'lobby');
});
test('position and capture updates do not resend task state or advance its revision',()=>{
 const s=fixture(),before=s.progressRevision;
 s.event({kind:'position',mode:'pve',profile:'pve-a',map:'customs',x:10,z:20,at:300});
 assert.equal(s.progressRevision,before);
 const update=s.snapshot(false);assert.equal(update.progress,undefined);assert.equal(update.ui,undefined);
 assert.equal(update.runtime.position.x,10);
 s.event({kind:'quest',id:'5936d90786f7742b1420ba5b',profile:'pve-a',status:'active',at:300});
 assert.equal(s.progressRevision,before+1);assert.equal(s.snapshot().progress['5936d90786f7742b1420ba5b'].status,'active');
});
test('saving an unchanged renderer state does not generate a progress feedback loop',()=>{
 const s=fixture(),state={pve:{taskCompletions:{},taskObjectives:{}}};
 assert.equal(s.saveUI({profile:'pve-a',state}),true);
 const before=s.progressRevision,mtime=fs.statSync(s.file).mtimeMs;
 assert.equal(s.saveUI({profile:'pve-a',state:JSON.parse(JSON.stringify(state))}),false);
 assert.equal(s.progressRevision,before);assert.equal(fs.statSync(s.file).mtimeMs,mtime);
});

test('different field ordering across windows does not rewrite identical progress',()=>{
 const s=fixture(),id='5936d90786f7742b1420ba5b';
 const state={currentGameMode:'pve',pve:{taskCompletions:{[id]:{complete:false,timestamp:300,failed:false,manual:false}},taskObjectives:{goal:{complete:true,count:1,timestamp:400}}}};
 assert.equal(s.saveUI({profile:'pve-a',state}),true);
 const before=s.progressRevision,mtime=fs.statSync(s.file).mtimeMs;
 const reordered={pve:{taskObjectives:{goal:{timestamp:400,count:1,complete:true}},taskCompletions:{[id]:{timestamp:300,manual:false,failed:false,complete:false}}},currentGameMode:'pve'};
 assert.equal(s.saveUI({profile:'pve-a',state:reordered}),false);
 assert.equal(s.progressRevision,before);assert.equal(fs.statSync(s.file).mtimeMs,mtime);
});

test('PvP positions use the live character while the PvE task profile remains unchanged',()=>{
 const s=fixture();s.profile().tasks['5936d90786f7742b1420ba5b']={status:'active',at:300,source:'manual'};
 const before=structuredClone(s.disk);
 s.event({kind:'profile',mode:'pvp',profile:'pvp-b'});
 s.event({kind:'map',mode:'pvp',profile:'pvp-b',map:'interchange'});
 s.event({kind:'position',mode:'pvp',profile:'pvp-b',map:'interchange',x:10,y:2,z:20,yaw:90,at:400});
 assert.equal(s.runtime.mode,'pvp');assert.equal(s.runtime.position.yaw,90);assert.equal(s.runtime.raid,'raid');
 assert.deepEqual(s.disk,before);assert.equal(s.snapshot().progress['5936d90786f7742b1420ba5b'].status,'active');
 s.event({kind:'profile',mode:'pve',profile:'pve-a',history:true});assert.equal(s.runtime.mode,'pvp');
 s.event({kind:'position',mode:'pve',profile:'pve-a',map:'woods',x:99,at:500});assert.equal(s.runtime.position.x,10);
});

test('switching game modes clears old positions and rejects late events from the other character',()=>{
 const s=fixture();
 s.event({kind:'position',mode:'pve',profile:'pve-a',map:'customs',x:10,at:300});
 s.event({kind:'profile',mode:'pvp',profile:'pvp-b'});
 assert.equal(s.runtime.position,null);assert.equal(s.runtime.map,null);assert.equal(s.runtime.raid,'lobby');
 s.event({kind:'map',mode:'pve',profile:'pve-a',map:'customs'});assert.equal(s.runtime.map,null);
 s.event({kind:'position',mode:'pvp',profile:'pvp-b',map:'interchange',x:20,at:400});
 s.event({kind:'profile',mode:'pve',profile:'pve-a'});
 assert.equal(s.runtime.position,null);assert.equal(s.runtime.mode,'pve');
 s.event({kind:'position',mode:'pvp',profile:'pvp-b',map:'interchange',x:20,at:500});assert.equal(s.runtime.position,null);
 s.event({kind:'position',mode:'pve',profile:'pve-a',map:'woods',x:30,at:600});assert.equal(s.runtime.position.x,30);
});

test('a blank portable profile can locate a PvP player without creating or selecting a PvE profile',()=>{
 const s=fixture();s.disk.selectedProfile='';s.disk.profiles={};
 s.event({kind:'profile',mode:'pvp',profile:'pvp-b'});
 s.event({kind:'position',mode:'pvp',profile:'pvp-b',map:'interchange',x:10,at:400});
 assert.equal(s.runtime.position.x,10);assert.equal(s.snapshot().profile,'');
 assert.deepEqual(s.disk.profiles,{});assert.deepEqual(s.snapshot().progress,{});
});

test('a stale window cannot erase a newly completed goal and a newer uncheck still works',()=>{
 const s=fixture();
 s.saveUI({profile:'pve-a',state:{pve:{taskObjectives:{}}}});
 const base=s.progressRevision;
 s.saveUI({profile:'pve-a',revision:base,state:{pve:{taskObjectives:{goal:{complete:true,timestamp:200}}}}});
 assert.equal(s.saveUI({profile:'pve-a',revision:base,state:{pve:{taskObjectives:{}}}}),false);
 assert.deepEqual(s.snapshot().ui.pve.taskObjectives.goal,{complete:true,timestamp:200});
 s.saveUI({profile:'pve-a',revision:base,state:{pve:{taskObjectives:{other:{complete:true,timestamp:250}}}}});
 assert.equal(s.snapshot().ui.pve.taskObjectives.goal.complete,true);
 assert.equal(s.snapshot().ui.pve.taskObjectives.other.complete,true);
 s.saveUI({profile:'pve-a',revision:s.progressRevision,state:{pve:{taskObjectives:{goal:{complete:false,timestamp:300},other:{complete:true,timestamp:250}}}}});
 assert.equal(new LocalStore(s.root).snapshot().ui.pve.taskObjectives.goal.complete,false);
 s.saveUI({profile:'pve-a',revision:s.progressRevision,state:{pve:{taskObjectives:{}}}});
 assert.deepEqual(s.snapshot().ui.pve.taskObjectives,{});
});
