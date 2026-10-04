import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCatalog} from '../catalog.mjs';
import {storyStatus,renderExtraConditions} from '../public/task-details.mjs';
import {mapForScene} from '../logs.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),c=loadCatalog(root);
test('supplemented task graph has no dangling prerequisites or cycles',()=>{
 const ids=new Set(c.tasks.map(t=>t.id));assert.equal(ids.size,c.tasks.length);
 const visited=new Set(),stack=new Set();
 function visit(t){if(visited.has(t.id))return;assert.ok(!stack.has(t.id),'Cycle '+t.name);stack.add(t.id);
  for(const p of t.requirements){assert.ok(ids.has(p.id),'Missing '+p.id);visit(c.tasks.find(q=>q.id===p.id));}
  stack.delete(t.id);visited.add(t.id);
 }
 c.tasks.forEach(visit);
 const live=c.tasks.filter(t=>!t.disabled);assert.ok(!live.some(t=>t.requirements.some(p=>c.tasks.find(q=>q.id===p.id).disabled)));
});
test('current Fuel Crisis and official PvE corrections retain alternatives and requirements',()=>{
 const fuel=c.tasks.find(t=>t.id==='5ae448f286f77448d73c0131');assert.equal(fuel.objectives.length,2);
 assert.deepEqual(fuel.objectives.map(o=>o.zones.length),[2,2]);
 assert.equal(c.tasks.filter(t=>t.disabled).length,42);
 assert.ok(c.tasks.some(t=>t.waitMin>0));assert.ok(c.tasks.some(t=>t.failConditions.length));
 const escort=c.tasks.find(t=>t.normalizedName==='escort');assert.ok(escort.level<46);assert.ok(escort.traderRequirements.some(r=>r.value===4));
 assert.equal(mapForScene('laboratory_dark_preset'),'实验室');
 assert.equal(mapForScene('rezerv_base_preset'),'储备站');
 for(const t of c.tasks)assert.equal(typeof renderExtraConditions(t,c,{progress:{},objectives:{}}),'string');
});
test('story guide completion cannot falsely complete chapters and Chinese coverage is preserved',()=>{
 const stories=c.tasks.filter(t=>t.story);assert.equal(stories.length,10);
 assert.equal(stories.reduce((n,t)=>n+t.objectives.length,0),430);
 assert.equal(stories.reduce((n,t)=>n+t.story.guide.length,0),461);
 for(const t of stories){
  assert.ok(t.objectives.every(o=>/[\u4e00-\u9fff]/.test(o.description)));
  assert.ok(t.story.guide.every(o=>/[\u4e00-\u9fff]/.test(o.description)));
  assert.equal(new Set(t.story.guide.map(s=>s.id)).size,t.story.guide.length);
  assert.equal(storyStatus(t,Object.fromEntries(t.story.groups.map(id=>[id,{status:'completed'}]))),'unknown');
  assert.equal(storyStatus(t,{[t.story.groups[0]]:{status:'active'}}),'active');
 }
});
test('new Wiki tasks use local IDs and expose manual-only limits; Lightkeeper chain connects',()=>{
 const refs=c.tasks.filter(t=>t.reference);assert.equal(refs.length,18);
 for(const t of refs){assert.ok(t.id.startsWith('wiki:'));assert.ok(t.reference.manualOnly);assert.ok(t.objectives.every(o=>o.id.startsWith('wiki:')));
 assert.match(renderExtraConditions(t,c,{progress:{},objectives:{}}),/手动记录/);}
 const acquainted=c.tasks.find(t=>t.id==='625d700cc48e6c62a440fab5');
 assert.deepEqual(acquainted.requirements.map(r=>r.id),['wiki:to-the-light-the-other-side']);
 assert.ok(!refs.some(t=>/Prestige|Arena/.test(t.reference.englishName)));
});
