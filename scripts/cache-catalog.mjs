import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {applyScreenshotTaskSupplements} from './screenshot-task-supplements.mjs';
const endpoints=['bootstrap','tasks-core','tasks-objectives','tasks-rewards','hideout','items-lite','map-spawns','editions','prestige'];
const folder=path.resolve('data/catalog');fs.mkdirSync(folder,{recursive:true});
async function download(name){
 const target=path.join(folder,name+'.json');
 const url='https://tarkovtracker.org/api/tarkov/'+name+'?lang=zh&gameMode=pve';
 await new Promise((resolve,reject)=>{
  const child=spawn('curl.exe',['--silent','--show-error','--fail','--location','--connect-timeout','5','--max-time','45','--retry','2','--output',target+'.tmp',url],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let error='';child.stderr.on('data',chunk=>error+=chunk);child.on('exit',code=>code===0?resolve():reject(Error(name+': '+error.trim())));
 });
 const data=JSON.parse(fs.readFileSync(target+'.tmp','utf8'));
 if(!data.data)throw Error(name+': invalid metadata response');
 const merged=applyScreenshotTaskSupplements(data,name,folder);
 if(merged!==data)fs.writeFileSync(target+'.tmp',JSON.stringify(merged));
 fs.renameSync(target+'.tmp',target);
 return {name,url,fetchedAt:new Date().toISOString(),overlay:data.dataOverlay?.version,bytes:fs.statSync(target).size};
}
const reports=[];
for(let offset=0;offset<endpoints.length;offset+=3){
 const batch=await Promise.allSettled(endpoints.slice(offset,offset+3).map(download));
 for(const result of batch){if(result.status==='fulfilled'){reports.push(result.value);console.log(result.value.name+': cached');}else{console.error(result.reason.message);process.exitCode=1;}}
}
fs.writeFileSync(path.join(folder,'sources.json'),JSON.stringify({scope:'public game metadata only; no player progress or account identifiers sent',records:reports},null,2));
