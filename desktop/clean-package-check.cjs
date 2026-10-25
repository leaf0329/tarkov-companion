const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({main,overlay,store,dataDir,origin,until})=>{
 const js=code=>main.webContents.executeJavaScript(code),checks=[];
 assert.equal(store.disk.selectedProfile,'');assert.deepEqual(store.disk.profiles,{});
 assert.equal(store.disk.settings.autoScreenshot,false);assert.equal(store.disk.settings.cleanupScreenshots,false);
 assert.equal(store.runtime.ready,false);assert.equal(store.runtime.capture.phase,'off');
 await until(()=>js("location.pathname==='/companion-settings' && document.body.textContent.includes('保存全部设置')"));
 assert.deepEqual(await js("Array.from(document.querySelectorAll('form input')).filter(e=>e.type==='text').map(e=>e.value)"),['','']);
 checks.push('blank profile opens directory setup with automatic screenshots and deletion disabled');
 const logs=path.resolve(dataDir,'CleanLogs'),shots=path.resolve(dataDir,'CleanScreenshots');
 fs.mkdirSync(logs);fs.mkdirSync(shots);
 const {dialog}=require('electron'),previous=dialog.showOpenDialog;
 let chosen=0;
 dialog.showOpenDialog=async(_window,options)=>{assert.deepEqual(options.properties,['openDirectory']);return {canceled:false,filePaths:[chosen++===0?logs:shots]};};
 try{
  await js("Array.from(document.querySelectorAll('form button')).filter(e=>e.textContent.includes('选择目录'))[0].click()");
  await until(()=>js("Array.from(document.querySelectorAll('form input')).filter(e=>e.type==='text')[0].value==="+JSON.stringify(logs)));
  await js("Array.from(document.querySelectorAll('form button')).filter(e=>e.textContent.includes('选择目录'))[1].click()");
  await until(()=>js("Array.from(document.querySelectorAll('form input')).filter(e=>e.type==='text')[1].value==="+JSON.stringify(shots)));
 }finally{dialog.showOpenDialog=previous;}
 assert.equal(chosen,2);
 // The personal assistant can stay open with F11 registered during this isolated check.
 await js("const key=document.querySelector('form select');key.value='F10';key.dispatchEvent(new Event('change',{bubbles:true}))");
 await js("document.querySelector('form button[type=submit]').click()");
 await until(()=>store.runtime.ready);
 assert.equal(store.disk.settings.logsPath,logs);assert.equal(store.disk.settings.screenshotsPath,shots);
 checks.push('directory buttons open the native picker and saving connects the bundled monitor');
 await main.loadURL(origin+'/companion-map');
 for(const win of [main,overlay]){
  await until(()=>win.webContents.executeJavaScript("document.querySelectorAll('.leaflet-container').length>0"));
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.companion-task-marker').length"),0);
 }
 await js('window.companion.overlay()');assert.equal(overlay.isVisible(),true);assert.equal(overlay.isFocusable(),false);
 await js('window.companion.overlay()');assert.equal(overlay.isVisible(),false);
 assert.equal(store.disk.selectedProfile,'');assert.deepEqual(store.disk.profiles,{});
 checks.push('relocated main map and overlay load without inherited task markers or profile data');
 return {ok:true,checks,at:new Date().toISOString()};
};
