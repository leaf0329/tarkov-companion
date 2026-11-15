const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const supplement = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog/verified-pve-task-supplements.json'),'utf8'));
const load = () => import('../scripts/task-catalog-supplements.mjs');

test('verified missing quests use real IDs and existing upstream goals win when available', async () => {
  const {mergeTaskCatalogSupplements} = await load();
  const id = '6a880acc9216d0f5aa078305';
  const upstream = {id,name:'Newer upstream record',objectives:[{id:'actual-game-goal'}]};
  const response = {data:{tasks:[upstream]},dataOverlay:{version:'fixture'}};
  const before = JSON.stringify(response);
  const merged = mergeTaskCatalogSupplements(response,supplement);
  assert.equal(merged.data.tasks.find(task=>task.id===id),upstream);
  assert.equal(JSON.stringify(response),before);
  assert.equal(merged.dataOverlay,response.dataOverlay);
  assert.equal(merged.data.tasks.length,19);
  assert.equal(mergeTaskCatalogSupplements(merged,supplement).data.tasks.length,19);
});

test('the supplemented chain has no missing prerequisites or cycles; alternatives remain one goal', () => {
  const byId = new Map(supplement.tasks.map(task=>[task.id,task]));
  const visit = (id,parents=[]) => {
    assert.ok(!parents.includes(id),'Cycle: '+parents.concat(id).join(' -> '));
    assert.ok(byId.has(id),'Missing predecessor: '+id);
    for (const required of byId.get(id).taskRequirements ?? []) visit(required.task.id,[...parents,id]);
  };
  for (const task of supplement.tasks) visit(task.id);
  const side = byId.get('6a88255e8636c03a2d09ba37');
  assert.deepEqual(side.objectives.map(goal=>goal.possibleLocations.reduce((sum,location)=>sum+location.positions.length,0)),[3,2,1]);
  assert.deepEqual(side.requiredKeys.map(group=>[group.keys.length,Boolean(group.anyOf)]),[[3,true],[2,true],[1,false]]);
  assert.deepEqual(side.objectives.map(goal=>goal.requiredKeys[0].length),[3,2,1]);
  const originalGoals = ['6391e2f9e705511c8a4a1b85','6391e31bfa894f0a866afdec','6391e329c115f907b14700b1','63ab727b1287ef0b827d0c95'];
  assert.deepEqual(byId.get('625d700cc48e6c62a440fab5').objectives.map(goal=>goal.id),originalGoals);
  const prestige = supplement.tasks.filter(task=>task.requiredPrestige);
  assert.deepEqual(prestige.map(task=>task.requiredPrestige.prestigeLevel),[1,2,3,4,5]);
  assert.deepEqual(prestige.map(task=>task.objectives.length),[6,8,9,17,19]);
  assert.equal(prestige[0].objectives[2].items.length,7);
  assert.equal(prestige[0].objectives[2].count,2);
  assert.equal(prestige[0].objectives[2].foundInRaid,true);
});

test('invalid or duplicate task and goal IDs fail before catalog writes', async () => {
  const {mergeTaskCatalogSupplements} = await load();
  const response = {data:{tasks:[]}};
  const invalid = structuredClone(supplement);
  invalid.tasks[0].id = 'placeholder_unverified';
  assert.throws(()=>mergeTaskCatalogSupplements(response,invalid),/task ID/);
  const duplicate = structuredClone(supplement);
  duplicate.tasks.push(duplicate.tasks[0]);
  assert.throws(()=>mergeTaskCatalogSupplements(response,duplicate),/duplicate supplemented task/);
  const goals = structuredClone(supplement);
  goals.tasks[0].objectives.push(goals.tasks[0].objectives[0]);
  assert.throws(()=>mergeTaskCatalogSupplements(response,goals),/duplicate objective/);
});
