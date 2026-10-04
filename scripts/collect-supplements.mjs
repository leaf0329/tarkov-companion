import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data/community');
await fs.mkdir(dir,{recursive:true});
const overlay=JSON.parse(await fs.readFile(path.join(dir,'overlay.json'),'utf8'));
async function get(url,options={}) {
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`${url}: ${r.status}`);
  return r.json();
}
const endpoints=['tasks','tasks_zh','tasks_en','maps_zh'];
const captured={};
const results=await Promise.all(endpoints.map(async endpoint=>{
  const value=await get(`https://json.tarkov.dev/pve/${endpoint}`);
  if(!value.data)throw new Error(`缺少 ${endpoint} 数据`);
  captured[endpoint]=value.data;
  await fs.writeFile(path.join(dir,endpoint+'.json'),JSON.stringify(value));
  return endpoint;
}));
console.log('已保存 PvE 数据：'+results.join(', '));
const pages={...Object.fromEntries(Object.values(overlay.storyChapters).map(c=>[c.id,c.wikiLink.split('/wiki/')[1]])),fuel:'Fuel_Crisis',escort:'Escort',lab:'The_Lab'};
const references=JSON.parse(await fs.readFile(path.join(dir,'wiki-tasks.json'),'utf8')).tasks;
for(const q of references)pages[q.id]=q.wikiLink.split('/wiki/')[1];
const wiki={};
const queue=Object.entries(pages);
async function worker(){
  while(queue.length){
    const [id,page]=queue.shift();
    const value=await get('https://escapefromtarkov.fandom.com/api.php',{method:'POST',body:new URLSearchParams({action:'parse',page,prop:'wikitext',format:'json'})});
    if(!value.parse?.wikitext?.['*'])throw new Error(`${page}: Wiki 内容为空`);
    wiki[id]={page,revision:value.parse.revid,source:`https://escapefromtarkov.fandom.com/wiki/${page}`,fetchedAt:new Date().toISOString(),wikitext:value.parse.wikitext['*']};
    console.log('已保存 Wiki：'+page);
  }
}
await Promise.all([worker(),worker()]);
await fs.writeFile(path.join(dir,'wiki.json'),JSON.stringify(wiki));
await fs.writeFile(path.join(dir,'provenance.json'),JSON.stringify({mode:'pve',fetchedAt:new Date().toISOString(),overlayCommit:'d3941924568541d43d8e5eb03120e3b5ec14e248',overlayVersion:overlay.$meta.version,overlayRepository:'https://github.com/tarkovtracker-org/tarkov-data-overlay',license:'MIT',sources:results.map(e=>`https://json.tarkov.dev/pve/${e}`)},null,2));
const provenance=JSON.parse(await fs.readFile(path.join(dir,'provenance.json'),'utf8'));
if(Object.keys(captured.tasks.tasks || {}).length<400 || Object.keys(wiki).length!==Object.keys(pages).length)throw Error('补充资料不完整，保留原快照');
const bundle={overlay,upstream:captured.tasks.tasks,zh:captured.tasks_zh,en:captured.tasks_en,mapsZh:captured.maps_zh,wiki,provenance};
await fs.writeFile(path.join(dir,'bundle.json.tmp'),JSON.stringify(bundle));
try{await fs.copyFile(path.join(dir,'bundle.json'),path.join(dir,'bundle.previous.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rename(path.join(dir,'bundle.json.tmp'),path.join(dir,'bundle.json'));
