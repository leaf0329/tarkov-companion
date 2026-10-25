const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({main,overlay,store,root,dataDir,origin,app,publish})=>{
 const checks=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
 const js=code=>main.webContents.executeJavaScript(code);
 const until=async(fn)=>{for(let n=0;n<240;n++){if(await fn())return;await wait(250);}throw Error('验收等待超时');};
 try{
  if(process.argv.includes('--clean-package-check')){
   const result=await require('./clean-package-check.cjs')({main,overlay,store,dataDir,origin,until});
   fs.writeFileSync(path.join(root,'data/clean-package-check-result.json'),JSON.stringify(result,null,2));
   app.quit();return;
  }
  await until(()=>store.runtime.ready);
  if(process.argv.includes('--overlay-fixes-check')){
   await require('./overlay-fixes-check.cjs')({main,overlay,store,root,dataDir,publish,wait,until,checks});
   fs.writeFileSync(path.join(dataDir,'result.json'),JSON.stringify({ok:true,checks},null,2));
   app.quit();return;
  }

  if(process.argv.includes('--pvp-map-check')){
   const result=await require('./pvp-map-check.cjs')({main,overlay,store,dataDir,until});
   fs.writeFileSync(path.join(root,'data/pvp-map-check-result.json'),JSON.stringify(result,null,2));
   app.quit();return;
  }
  if(process.argv.includes('--imported-profile-check')){
   const result=await require('./imported-profile-check.cjs')({main,overlay,store,root,publish,until});
   fs.writeFileSync(path.join(root,'data/imported-profile-check-result.json'),JSON.stringify(result,null,2));
   app.quit();return;
  }
  assert.equal(store.profile().tasks['5936d90786f7742b1420ba5b'].status,'active');checks.push('TarkovMonitor native engine replays a real-format official PvE task event');
  await until(()=>js("document.querySelectorAll('.leaflet-container').length>0 && document.querySelectorAll('aside a').length>0"));
  if(process.argv.includes('--map-controls-only')){
   await require('./map-controls.cjs')({main,overlay,store,root,dataDir,wait,until,checks});
   fs.writeFileSync(path.join(root,'data/acceptance-result.json'),JSON.stringify({ok:true,checks},null,2));
   app.quit();return;
  }
  assert.equal(await js("!!window.companion"),true);checks.push('Chinese local task/map UI loads with IPC and active task');
  assert.equal(overlay.isFocusable(),false);assert.equal(overlay.isAlwaysOnTop(),true);checks.push('native overlay preserves game keyboard focus');
  await until(()=>overlay.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('自动截图'))"));
  assert.equal(await overlay.webContents.executeJavaScript("getComputedStyle(document.querySelector('[data-testid=companion-toolbar]')).webkitAppRegion"),'no-drag');
  await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('自动截图')).click()");
  await until(()=>store.disk.settings.autoScreenshot);
  await until(()=>overlay.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('自动截图') && b.textContent.includes('5s'))"));
  assert.equal(JSON.parse(fs.readFileSync(store.file)).settings.autoScreenshot,true);
  await overlay.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('自动截图')).click()");
  await until(()=>!store.disk.settings.autoScreenshot);assert.equal(store.runtime.capture.phase,'off');checks.push('overlay capture control synchronizes and stops automatic keys');
  await require('./settings-save.cjs')({main,overlay,store,dataDir,origin,publish,wait,until,checks});
  const profile=store.disk.selectedProfile,id='5936d90786f7742b1420ba5b';
  store.event({kind:'quest',id,profile,status:'completed',at:Date.now(),history:false});publish();
  await until(()=>js("document.querySelectorAll('aside a').length===0"));checks.push('completed task leaves current-task list immediately');
  await main.reload();await until(()=>js("document.querySelectorAll('.leaflet-container').length>0"));
  assert.equal(store.profile().tasks[id].status,'completed');checks.push('local progress survives renderer restart');
  await js("window.companion.saveSettings({follow:false})");
  const shot='2026-10-12[12-00]_102.30, 2.96, -5.91_0.0, 0.0, 0.0, 1.0 (0).png';
  fs.writeFileSync(path.join(store.disk.settings.screenshotsPath,shot),'test');
  await until(()=>!!store.runtime.position);
  await until(()=>js("document.querySelectorAll('.companion-player').length===1"));checks.push('native screenshot coordinates render a player marker on upstream map');
  const mapTask='5b4795fb86f7745876267770';
  store.event({kind:'quest',id:mapTask,profile,status:'active',at:Date.now(),history:false});publish();
  await until(()=>js("document.querySelectorAll('.companion-task-marker').length===1"));
  await js("document.querySelector('.companion-task-marker').click()");
  await until(()=>js("document.querySelectorAll('.map-objective-popup').length>0"));checks.push('one merchant avatar/name task marker opens the upstream objective popup');
  store.event({kind:'quest',id:mapTask,profile,status:'completed',at:Date.now()+1,history:false});publish();
  await until(()=>js("document.querySelectorAll('.companion-task-marker').length===0"));checks.push('task completion removes the map marker');
  await require('./map-keys.cjs')({main,overlay,store,dataDir,publish,wait,until,checks});
  await overlay.webContents.executeJavaScript("window.companion.saveSettings({opacity:70})");assert.equal(Math.round(overlay.getOpacity()*100),70);checks.push('native map opacity changes');
  await main.loadURL(origin+'/tasks');await until(()=>js("document.body.textContent.includes('任务')"));checks.push('upstream task screen and graph route load');
  await until(()=>js("!!document.querySelector('button[aria-label=\"图表\"]')"));
  await js("document.querySelector('button[aria-label=\"图表\"]').click()");
  await until(()=>js("document.querySelectorAll('.vue-flow__node').length>0"));checks.push('upstream task tree renders actual quest nodes');
  await main.loadURL(origin+'/companion-map');await until(()=>js("Array.from(document.querySelectorAll('.leaflet-pane svg')).some(s=>s.querySelectorAll('path').length>20) && document.body.textContent.includes('leaf0329')"));
  await require('./map-performance.cjs')({main,overlay,store,root,publish,wait,until,checks});
  await require('./map-resume.cjs')({main,overlay,store,root,publish,wait,until,checks});
  await require('./overlay-sync.cjs')({main,overlay,store,root,dataDir,origin,publish,wait,until,checks});
  await require('./task-details.cjs')({main,overlay,store,root,dataDir,publish,wait,until,checks});
  await require('./map-controls.cjs')({main,overlay,store,root,dataDir,wait,until,checks});
  await wait(1000);
  main.showInactive();
  await wait(600);
  fs.writeFileSync(path.join(dataDir,'main.png'),(await main.webContents.capturePage()).toPNG());
  main.hide();
  overlay.showInactive();await wait(250);
  fs.writeFileSync(path.join(dataDir,'overlay.png'),(await overlay.webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(root,'data/acceptance-result.json'),JSON.stringify({ok:true,checks},null,2));
 }catch(error){
  const page=await js("({url:location.href,text:document.body.innerText.slice(0,6000),bridge:!!window.companion})").catch(()=>null);
  const report=process.argv.includes('--overlay-fixes-check')?path.join(dataDir,'result.json'):path.join(root,'data/acceptance-result.json');
  fs.writeFileSync(report,JSON.stringify({ok:false,checks,error:error.stack,page,runtime:store.runtime},null,2));
  const failureImage=await main.webContents.capturePage().catch(()=>null);
  if(failureImage)fs.writeFileSync(path.join(dataDir,'failure.png'),failureImage.toPNG());
 }
 app.quit();
};
