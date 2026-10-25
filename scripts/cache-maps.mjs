import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const maps=JSON.parse(fs.readFileSync('source/tracker/app/data/maps.json','utf8'));
const files=[...new Set(Object.values(maps).flatMap(map=>map.svg?.file?[map.svg.file]:[]))];
const folder='source/tracker/public/companion/maps';fs.mkdirSync(folder,{recursive:true});
async function download(file){
 const target=path.join(folder,file),url='https://assets.tarkov.dev/maps/svg/'+encodeURIComponent(file);
 await new Promise((resolve,reject)=>{const child=spawn('curl.exe',['--silent','--show-error','--fail','--location','--connect-timeout','5','--max-time','30','--retry','2','--output',target+'.tmp',url],{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',value=>error+=value);child.on('exit',code=>code===0?resolve():reject(Error(file+': '+error)));});
 if(!fs.readFileSync(target+'.tmp','utf8').includes('<svg'))throw Error(file+': invalid SVG');
 fs.renameSync(target+'.tmp',target);console.log(file+': cached');
}
for(let offset=0;offset<files.length;offset+=3){const results=await Promise.allSettled(files.slice(offset,offset+3).map(download));for(const result of results)if(result.status==='rejected'){console.error(result.reason.message);process.exitCode=1;}}
