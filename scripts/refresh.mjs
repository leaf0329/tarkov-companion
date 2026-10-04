import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = 'https://member.kaedeori.com';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const dataDir = path.join(root, 'data');
const dir = path.join(dataDir, 'refresh-' + run);
await fs.mkdir(dir, { recursive: true });
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.code !== 200 || !body.data?.data) throw new Error('数据格式异常');
  return body;
}
const list = await get(`${base}/api/tarkov/task/list?page=1&pageSize=999&lang=zh&gameMode=pve`);
if (list.data.data.length < list.data.total) throw new Error('任务列表不完整');
const tree = await get(`${base}/api/tarkov/task/dagre?lang=zh&gameMode=pve`);
const queue = [...list.data.data];
const errors = [];
let done = 0;
async function worker() {
  while (queue.length) {
    const task = queue.shift();
    try {
      const detail = await get(`${base}/api/tarkov/task/detail?id=${task.id}&lang=zh&gameMode=pve`);
      if(detail.data.data.id !== task.id || !Array.isArray(detail.data.data.objectives))throw new Error('任务详情不完整');
      await fs.writeFile(path.join(dir, `${task.id}.json`), JSON.stringify(detail.data.data));
    } catch (error) { errors.push({ id: task.id, error: error.message }); }
    done++;
    if (done % 50 === 0) console.log(`任务数据 ${done}/${list.data.data.length}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
await Promise.all([worker(), worker(), worker()]);
if (errors.length) {
  await fs.writeFile(path.join(root, 'data/refresh-errors.json'), JSON.stringify(errors, null, 2));
  throw new Error(`${errors.length} 个任务下载失败；已保留上次完整数据，请重新更新`);
}
const backup = path.join(dataDir, 'backups', 'tasks-' + run);
await import('./collect-supplements.mjs');
await fs.mkdir(backup, { recursive:true });
for(const name of ['current-tasks.json','current-tree.json','source.json']) {
  try{await fs.copyFile(path.join(dataDir,name),path.join(backup,name));}catch(e){if(e.code!=='ENOENT')throw e;}
}
try{await fs.rename(path.join(dataDir,'details'),path.join(backup,'details'));}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rename(dir,path.join(dataDir,'details'));
await fs.writeFile(path.join(root, 'data/current-tasks.json'), JSON.stringify(list));
await fs.writeFile(path.join(root, 'data/current-tree.json'), JSON.stringify(tree));
await fs.writeFile(path.join(root, 'data/source.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), mode: 'pve', taskCount: done, url: base, toolbox: '复用地图底图、头像、校准与物品名称', taskPoints:'当前正式版 PvE 目标坐标' }, null, 2));
console.log(`已更新 ${done} 个正式版 PvE 任务。请重启助手服务以加载新数据。`);
