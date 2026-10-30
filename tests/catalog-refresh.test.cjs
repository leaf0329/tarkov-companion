const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const childProcess = require('node:child_process');
const {syncBuiltinESMExports} = require('node:module');
const {pathToFileURL} = require('node:url');

test('refresh registers new event scene names, excludes placeholder quests and preserves personal data', async () => {
  const script = path.resolve(__dirname, '../scripts/cache-catalog.mjs');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-catalog-'));
  const previousDirectory = process.cwd();
  const previousSpawn = childProcess.spawn;
  const state = {settings:{logsPath:'private-location'},profiles:{example:{tasks:{accepted:{status:'active'}}}}};
  fs.mkdirSync(path.join(fixture,'data'));
  fs.writeFileSync(path.join(fixture,'data/companion.json'),JSON.stringify(state));
  const map = {id:'6a8dd1325e15a5ea2e010820',nameId:'factory_event',name:'工厂疫区',normalizedName:'infected-factory'};
  childProcess.spawn = (_command,args) => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      const file = args[args.indexOf('--output')+1];
      const data = file.includes('tasks-core')
        ? {maps:[map],tasks:[{id:'5936d90786f7742b1420ba5b',name:'Accepted quest'},{id:'placeholder_event',name:'Unverified'}]}
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
    assert.deepEqual(read('catalog/tasks-core.json').data.tasks.map(task=>task.id),['5936d90786f7742b1420ba5b']);
    assert.deepEqual(read('companion.json'),state);
    assert.equal(fs.existsSync(path.join(fixture,'data/maps.json.tmp')),false);
  } finally {
    process.chdir(previousDirectory);
    childProcess.spawn = previousSpawn;
    syncBuiltinESMExports();
    assert.equal(path.dirname(fixture),fs.realpathSync(os.tmpdir()));
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
