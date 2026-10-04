import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createCipheriv} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import JavaScriptObfuscator from 'javascript-obfuscator';
import {build,Platform,Arch} from 'electron-builder';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staging=path.join(root,'build/portable-app');
fs.mkdirSync(staging,{recursive:true});
const files={};
const options={compact:true,renameGlobals:false,controlFlowFlattening:false,deadCodeInjection:false,stringArray:true,stringArrayThreshold:0.75,stringArrayEncoding:['base64'],identifierNamesGenerator:'hexadecimal',selfDefending:false,debugProtection:false,sourceMap:false};
function add(relative,obfuscate=false){
  let bytes=fs.readFileSync(path.join(root,relative));
  if(obfuscate)bytes=Buffer.from(JavaScriptObfuscator.obfuscate(bytes.toString('utf8'),{...options,target:relative.startsWith('public/')?'browser':'node'}).getObfuscatedCode());
  files[relative]=bytes.toString('base64');
}
function tree(relative,obfuscate=false){
  for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
    const name=relative+'/'+entry.name;
    if(entry.isDirectory())tree(name,obfuscate);
    else if(entry.isFile())add(name,obfuscate && /\.(?:mjs|cjs|js)$/.test(name));
  }
}
for(const file of ['server.mjs','catalog.mjs','supplements.mjs','logs.mjs','overlay.mjs','overlay-settings.cjs','auto-screenshot.mjs','screenshot-cleanup.mjs','desktop/overlay.cjs','desktop/native-actions.cjs','desktop/portable-smoke.cjs'])add(file,true);
tree('public',true);
tree('vendor');
add('scripts/screenshot-key.ps1');
for(const file of ['data/current-tasks.json','data/item-names.json','data/source.json','data/toolbox/map_地图数据.json','data/community/bundle.json','data/community/provenance.json','data/community/guide-zh.json','data/community/wiki-tasks.json'])add(file);
tree('data/details');
add('node_modules/@dagrejs/dagre/dist/dagre.min.js');
add('node_modules/@dagrejs/dagre/LICENSE');
files['package.json']=Buffer.from('{"type":"module","private":true}').toString('base64');
if(Object.keys(files).some(p=>/(?:^|\/)(?:state\.json|backups|screenshots|overlay-runtime)(?:\/|$)|\.log$/i.test(p)))throw Error('便携包包含用户数据');
const key=randomBytes(32),iv=randomBytes(12),encrypt=createCipheriv('aes-256-gcm',key,iv);
const compressed=gzipSync(Buffer.from(JSON.stringify(files)),{level:6});
const encrypted=Buffer.concat([encrypt.update(compressed),encrypt.final()]);
fs.writeFileSync(path.join(staging,'payload.bin'),Buffer.concat([iv,encrypt.getAuthTag(),encrypted]));
const entry=fs.readFileSync(path.join(root,'desktop/portable-entry.cjs'),'utf8').replace('__PAYLOAD_KEY__',key.toString('base64'));
fs.writeFileSync(path.join(staging,'main.cjs'),JavaScriptObfuscator.obfuscate(entry,{...options,target:'node',stringArrayThreshold:1}).getObfuscatedCode());
fs.writeFileSync(path.join(staging,'package.json'),JSON.stringify({name:'tarkov-personal-portable',version:'1.0.2',description:'Local PvE task and map companion',author:'leaf0329',license:'SEE LICENSE IN LICENSE',main:'main.cjs',private:true}));
fs.copyFileSync(path.join(root,'desktop/PORTABLE-NOTICES.md'),path.join(staging,'PORTABLE-NOTICES.md'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(staging,'LICENSE'));
console.log(`Encrypted ${Object.keys(files).length} runtime files; no user state, logs, screenshots, or local settings.`);
await build({targets:Platform.WINDOWS.createTarget(['portable'],Arch.x64),config:{
  appId:'local.tarkov.personal.portable',productName:'TarkovPersonal',electronVersion:'44.5.1',electronDist:path.join(root,'node_modules/electron/dist'),
  directories:{app:staging,output:path.join(root,'dist')},files:['main.cjs','payload.bin','package.json','PORTABLE-NOTICES.md','LICENSE','!node_modules/**/*'],asar:true,npmRebuild:false,
  win:{target:['portable'],signAndEditExecutable:false,artifactName:'leaf0329-Tarkov-Companion-1.0.2.exe'},
  portable:{requestExecutionLevel:'user'},compression:'normal'
}});
