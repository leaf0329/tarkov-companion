import fs from 'node:fs';
import path from 'node:path';
const dir='data/acceptance',logs=path.resolve(dir,'Logs'),shots=path.resolve(dir,'Screenshots');
const browser=path.resolve(dir,'browser');
if(!browser.startsWith(path.resolve(dir)+path.sep))throw Error('Invalid acceptance browser directory');
// Completed objectives persist in browser storage, so each fixture needs a fresh browser profile.
fs.rmSync(browser,{recursive:true,force:true});
const session=path.join(logs,'log_2026.10.12_12-00-00_1.2.0.0');
fs.mkdirSync(session,{recursive:true});fs.mkdirSync(shots,{recursive:true});
const fixtureShot=path.join(shots,'2026-10-12[12-00]_102.30, 2.96, -5.91_0.0, 0.0, 0.0, 1.0 (0).png');
if(fs.existsSync(fixtureShot))fs.unlinkSync(fixtureShot);
const at=Date.now()-10000;
const maps=JSON.parse(fs.readFileSync('data/maps.json','utf8')).data.maps;
const scene=maps['56f40101d2720b2a4d8b45d6'].scenePath;
const line=(offset,text)=>new Date(at+offset).toISOString().replace('T',' ').replace('Z',' +00:00')+'|1.2.0.0.48000|Info|application|'+text+'\n';
fs.writeFileSync(path.join(session,'application_000.log'),line(0,'Session mode: Pve')+line(10,'PrepareSelectedProfileLocally ProfileId:aaaaaaaaaaaaaaaaaaaaaaaa AccountId:123')+line(20,'scene preset path:'+scene));
const message={type:'new_message',message:{type:10,dt:Math.floor((at+100)/1000),templateId:'5936d90786f7742b1420ba5b description'}};
fs.writeFileSync(path.join(session,'push-notifications_000.log'),line(100,'Got notification | ChatMessageReceived')+JSON.stringify(message,null,2)+'\n');
fs.writeFileSync(path.join(dir,'companion.json'),JSON.stringify({settings:{logsPath:logs,screenshotsPath:shots,hotkey:'F10',opacity:85,interval:5,autoScreenshot:false,cleanupScreenshots:false,follow:true},selectedProfile:'aaaaaaaaaaaaaaaaaaaaaaaa',profiles:{aaaaaaaaaaaaaaaaaaaaaaaa:{tasks:{},objectives:{},ui:{}}}},null,2));
