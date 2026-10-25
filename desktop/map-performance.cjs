const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({main,overlay,store,root,publish,wait,until,checks})=>{
 const js=code=>overlay.webContents.executeJavaScript(code);
 const disk=JSON.parse(fs.readFileSync(path.join(root,'data/companion.json')));
 const real=disk.profiles[disk.selectedProfile],profile=store.disk.selectedProfile;
 const replica=JSON.parse(JSON.stringify(real));
 if(replica.ui)replica.ui.tarkovUid=null;
 const at=Date.now(),task='5b4795fb86f7745876267770';
 replica.tasks[task]={status:'active',at,source:'test'};
 if(replica.ui?.pve){
  replica.ui.pve.taskCompletions[task]={complete:false,failed:false,manual:false,timestamp:at};
  for(const id of ['5b4796c086f7745877352c2c','5b47971086f774587877ad34'])delete replica.ui.pve.taskObjectives[id];
 }
 store.disk.profiles[profile]=replica;store.progressRevision++;publish();
 main.hide();overlay.showInactive();
 await until(()=>js("document.querySelectorAll('.companion-task-marker').length>0 && !!document.querySelector('[data-testid=companion-floor-select]')"));
 assert.equal(main.webContents.getBackgroundThrottling(),false);
 assert.equal(overlay.webContents.getBackgroundThrottling(),false);
 assert.equal(overlay.isFocused(),false);
 await wait(1800);
 const before=store.progressRevision;
 await js("window.__acceptanceTask=document.querySelector('.companion-task-marker');window.__acceptanceArrow=document.querySelector('.companion-player');window.__frameStats={frames:0,maxGap:0,last:performance.now(),running:true};function measureFrame(time){const stats=window.__frameStats;stats.frames++;stats.maxGap=Math.max(stats.maxGap,time-stats.last);stats.last=time;if(stats.running)requestAnimationFrame(measureFrame)}requestAnimationFrame(measureFrame)");
 for(let n=0;n<80;n++){
  store.runtime.capture={...store.runtime.capture,message:'performance fixture '+n};publish();await wait(25);
 }
 await wait(600);
 assert.equal(store.progressRevision,before,'runtime updates must not write task progress back');
 assert.equal(await js("window.__acceptanceTask===document.querySelector('.companion-task-marker')"),true);
 checks.push('realistic progress load: 80 runtime updates do not rewrite progress or rebuild task markers');
 const oldPosition=store.runtime.position;
 const oldTransform=await js("document.querySelector('.companion-player').style.transform");
 overlay.hide();
 store.event({kind:'position',mode:'pve',profile,map:oldPosition.map,x:oldPosition.x+30,y:oldPosition.y,z:oldPosition.z+20,yaw:90,at:Date.now()});publish();
 await until(()=>js("document.querySelector('.companion-player').style.transform!=="+JSON.stringify(oldTransform)));
 assert.equal(await js("window.__acceptanceArrow===document.querySelector('.companion-player')"),true);
 await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('跟随')).click()");
 await until(()=>store.disk.settings.follow);
 await until(()=>js("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('跟随') && b.textContent.includes('开'))"));
 await js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('跟随')).click()");
 await until(()=>!store.disk.settings.follow);
 checks.push('hidden unfocused overlay receives new coordinates and handles toolbar controls');
 overlay.showInactive();
 const layers=await js(`(async()=>{
  const select=document.querySelector('[data-testid=companion-floor-select]');
  const latencies=[];
  for(let n=0;n<12;n++){
   const start=performance.now();select.click();
   await new Promise(requestAnimationFrame);
   const options=Array.from(document.querySelectorAll('[role=option]'));
   if(!options.length)throw Error('Floor menu did not open');
   options[n%options.length].click();
   await new Promise(requestAnimationFrame);latencies.push(performance.now()-start);
  }
  const before=select.dataset.value;
  document.querySelector('.leaflet-container').dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:100,bubbles:true,cancelable:true}));
  await new Promise(requestAnimationFrame);
  return {latencies,selectorCount:document.querySelectorAll('[data-testid=companion-floor-select]').length,ctrlWheelChangesFloor:select.dataset.value!==before};
 })()`);
 assert.equal(layers.selectorCount,1);assert.equal(layers.ctrlWheelChangesFloor,true);
 assert.equal(await js("window.__acceptanceTask===document.querySelector('.companion-task-marker')"),true);
 assert.ok(Math.max(...layers.latencies)<1500,'floor changes must not stall the renderer');
 checks.push('one floor selector and Ctrl+wheel switch floors without rebuilding objective markers');
 const drag=await js(`(async()=>{
  const container=document.querySelector('.leaflet-container'),pane=container.querySelector('.leaflet-map-pane');
  const start=performance.now(),before=pane.style.transform,bounds=container.getBoundingClientRect();
  const x=bounds.left+240,y=bounds.top+180;
  container.dispatchEvent(new MouseEvent('mousedown',{button:0,buttons:1,clientX:x,clientY:y,bubbles:true}));
  for(let n=0;n<12;n++){
   container.dispatchEvent(new MouseEvent('mousemove',{button:0,buttons:1,clientX:x+n*4,clientY:y+n*3,bubbles:true}));
   await new Promise(requestAnimationFrame);
  }
  container.dispatchEvent(new MouseEvent('mouseup',{button:0,clientX:x+44,clientY:y+33,bubbles:true}));
  return {moved:pane.style.transform!==before,elapsed:performance.now()-start};
 })()`);
 assert.equal(drag.moved,true);assert.ok(drag.elapsed<2000);
 const frame=await js("window.__frameStats.running=false;({...window.__frameStats})");
 assert.ok(frame.frames>10);assert.ok(frame.maxGap<1500);
 checks.push('unfocused overlay stays responsive during drag and repeated floor changes');
 fs.writeFileSync(path.join(root,'data/map-performance-result.json'),JSON.stringify({ok:true,taskCount:Object.keys(replica.tasks).length,activeTasks:Object.values(replica.tasks).filter(t=>t.status==='active').length,progressWritesDuringRuntimeUpdates:store.progressRevision-before,floorSwitchMaxMs:Math.round(Math.max(...layers.latencies)),dragMs:Math.round(drag.elapsed),maxFrameGapMs:Math.round(frame.maxGap),frames:frame.frames},null,2));
};
