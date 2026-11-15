const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const childProcess = require('node:child_process');
const {syncBuiltinESMExports} = require('node:module');
const {pathToFileURL} = require('node:url');

test('refresh retains verified quest lines, registers maps and leaves personal progress untouched', async () => {
  const script = path.resolve(__dirname, '../scripts/cache-catalog.mjs');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-catalog-'));
  const previousDirectory = process.cwd();
  const previousSpawn = childProcess.spawn;
  const state = {settings:{logsPath:'private-location'},selectedProfile:'example',profiles:{example:{tasks:{'6a880acc9216d0f5aa078305':{status:'active'},new_beginning_prestige_5:{status:'completed'}}}}};
  fs.mkdirSync(path.join(fixture,'data/catalog'),{recursive:true});
  fs.writeFileSync(path.join(fixture,'data/companion.json'),JSON.stringify(state));
  const stateBytes = fs.readFileSync(path.join(fixture,'data/companion.json'));
  fs.copyFileSync(path.resolve(__dirname,'../data/catalog/verified-pve-task-supplements.json'),path.join(fixture,'data/catalog/verified-pve-task-supplements.json'));
  const map = {id:'6a8dd1325e15a5ea2e010820',nameId:'factory_event',name:'工厂疫区',normalizedName:'infected-factory'};
  childProcess.spawn = (_command,args) => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      const file = args[args.indexOf('--output')+1];
      const data = /tasks-(core|objectives|rewards)/.test(file)
        ? {maps:[map],tasks:[{id:'5936d90786f7742b1420ba5b',name:'Accepted quest'},{id:'placeholder_event',name:'Unverified'},{id:'new_beginning_prestige_5',name:'Synthetic'},{id:'6a763df2161e4b45b1015663',name:'Temporary event'},{id:'625d700cc48e6c62a440fab5',taskRequirements:[{task:{id:'625d7005a4eb80027c4f2e09'}}]}]}
        : {};
      fs.writeFileSync(file,JSON.stringify({data}));
      child.emit('exit',0);
    });
    return child;
  };
  syncBuiltinESMExports();
  process.chdir(fixture);
  try {
    await import(pathToFileURL(script).href);
    const read = file => JSON.parse(fs.readFileSync(path.join(fixture,'data',file),'utf8'));
    assert.equal(read('maps.json').data.maps[map.id].nameId,'factory_event');
    for (const endpoint of ['tasks-core','tasks-objectives','tasks-rewards']) {
      const tasks = read('catalog/'+endpoint+'.json').data.tasks;
      assert.equal(tasks.length,20);
      const trust = tasks.find(task=>task.id==='6a880acc9216d0f5aa078305');
      assert.equal(trust.name,'逐光而行 - 审慎信任');
      assert.equal(trust.objectives.length,2);
      assert.equal(tasks.some(task=>/^(placeholder_|new_beginning_prestige_)/.test(task.id)),false);
      assert.equal(tasks.some(task=>task.id==='6a763df2161e4b45b1015663'),false);
      assert.equal(tasks.find(task=>task.id==='625d700cc48e6c62a440fab5').taskRequirements[0].task.id,'6a88255e8636c03a2d09ba37');
    }
    assert.deepEqual(read('companion.json'),state);
    assert.deepEqual(fs.readFileSync(path.join(fixture,'data/companion.json')),stateBytes);
    assert.equal(fs.existsSync(path.join(fixture,'data/maps.json.tmp')),false);
  } finally {
    process.chdir(previousDirectory);
    childProcess.spawn = previousSpawn;
    syncBuiltinESMExports();
    assert.equal(path.dirname(fixture),fs.realpathSync(os.tmpdir()));
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
