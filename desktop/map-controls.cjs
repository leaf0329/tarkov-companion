const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({main,overlay,store,root,dataDir,wait,until,checks})=>{
 const js=code=>overlay.webContents.executeJavaScript(code);
 const debug=overlay.webContents.debugger;
 let stage='floor menu';
 const mapSelect='[data-testid=companion-map-select]',floorSelect='[data-testid=companion-floor-select]';
 const background="Array.from(document.querySelectorAll('.leaflet-pane')).find(p=>p.style.zIndex==='200')?.querySelector('svg')";
 const click=async(expression)=>{
  const point=await js(`(()=>{const el=${expression};if(!el)throw Error('Missing click target');el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  await debug.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
  await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  await wait(80);
 };
 const choose=async(selector,label)=>{
  await click(`document.querySelector(${JSON.stringify(selector)})`);
  await until(()=>js("document.querySelectorAll('[role=option]').length>0"));
  await click(`Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent.trim()===${JSON.stringify(label)})`);
  await until(()=>js("document.querySelectorAll('[role=option]').length===0"));
 };
 const overview=async()=>{
  await click("document.querySelector('[data-testid=map-reset-view]')");
  await until(()=>!store.disk.settings.follow);
  await wait(250);
  const result=await js(`(()=>{const container=document.querySelector('.leaflet-container').getBoundingClientRect(),svg=(${background}).getBoundingClientRect(),controls=document.querySelector('[data-testid=map-toolbar]').getBoundingClientRect();return {visible:svg.left>=container.left-1 && svg.top>=controls.bottom+8 && svg.right<=container.right+1 && svg.bottom<=container.bottom+1,width:svg.width,height:svg.height,viewportWidth:container.width,viewportHeight:container.height}})()`);
  assert.equal(result.visible,true,JSON.stringify(result));
  return result;
 };
 await until(()=>js(`!!document.querySelector(${JSON.stringify(floorSelect)}) && !!(${background})`));
 main.hide();overlay.showInactive();
 assert.equal(overlay.isFocusable(),false);assert.equal(overlay.isFocused(),false);
 debug.attach('1.3');
 try{
  await js("window.__trustedMenuClick=false;document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-testid=companion-map-select], [data-testid=companion-floor-select]'))window.__trustedMenuClick=e.isTrusted},true)");
  await choose(floorSelect,'2nd Floor');
  assert.equal(await js(`document.querySelector(${JSON.stringify(floorSelect)}).dataset.value`),'2nd Floor');
  await choose(mapSelect,'工厂');
  await until(()=>js(`document.querySelector(${JSON.stringify(mapSelect)}).dataset.value==='55f2d3fd4bdc2d5f408b4567' && !!(${background})`));
  assert.equal(await js("window.__trustedMenuClick"),true);
  assert.equal(overlay.isFocused(),false);assert.equal(overlay.isFocusable(),false);
  checks.push('trusted mouse clicks open map and floor menus and choose entries in the nonfocusable overlay');
  const definitions=JSON.parse(fs.readFileSync(path.join(root,'source/tracker/app/data/maps.json')));
  const raw=JSON.parse(fs.readFileSync(path.join(root,'data/catalog/tasks-core.json'))).data.maps;
  const aliases={'ground-zero':'groundzero','streets-of-tarkov':'streetsoftarkov'};
  const maps=raw.filter(m=>definitions[aliases[m.normalizedName] ?? m.normalizedName]?.svg);
  const views=[];
  const placeLabel = name => `Array.from(document.querySelectorAll('.companion-place-label')).find(el=>el.textContent.includes(${JSON.stringify(name)}))`;
  for(const map of maps){
   stage='overview: '+map.name;
   if(await js(`document.querySelector(${JSON.stringify(mapSelect)}).dataset.value!==${JSON.stringify(map.id)}`)){
    await js(`window.__previousOverviewSvg=${background}`);
    await choose(mapSelect,map.name);
    await until(()=>js(`document.querySelector(${JSON.stringify(mapSelect)}).dataset.value===${JSON.stringify(map.id)} && !!(${background}) && (${background})!==window.__previousOverviewSvg`));
   }
   views.push({map:map.name,...await overview()});
   if(map.normalizedName==='ground-zero'){
    await until(()=>js(`!!(${placeLabel('TerraGroup')})`));
    const label=await js(`(()=>{const el=${placeLabel('TerraGroup')};const r=el.firstElementChild.getBoundingClientRect();return {text:el.textContent,visible:el.style.display!=='none',keyboard:el.getAttribute('tabindex'),pointerEvents:getComputedStyle(el).pointerEvents,intercepts:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.companion-place-label')}})()`);
    assert.ok(label.text.includes('泰拉集团'));
    assert.equal(label.visible,true);assert.equal(label.keyboard,null);assert.equal(label.pointerEvents,'none');assert.equal(label.intercepts,false);
    fs.writeFileSync(path.join(dataDir,'groundzero-place-names.png'),(await overlay.webContents.capturePage()).toPNG());
    stage='place names: zoom';
    for(let step=0;step<3;step++){
     await click("document.querySelector('[data-testid=map-zoom-in]')");
     await wait(350);
    }
    await until(()=>js(`(${placeLabel('ASAP Winery')}).style.display!=='none'`));
    stage='place names: floor';
    await choose(floorSelect,'2nd Floor');
    await until(()=>js(`(${placeLabel('Science Office')}).style.display!=='none' && (${placeLabel('ASAP Winery')}).style.display==='none'`));
    await choose(floorSelect,'Ground Level');
    await overview();
    checks.push('place names render in Chinese with original names, follow floor/zoom changes and never intercept map input');
   }
   if(map.normalizedName==='streets-of-tarkov')fs.writeFileSync(path.join(dataDir,'streets-overview.png'),(await overlay.webContents.capturePage()).toPNG());
  }
  assert.ok(views.length>=8);
  checks.push('local SVG maps fit completely inside the overlay after choosing the full-map view');
  await choose(mapSelect,'海关');
  await until(()=>js(`document.querySelector(${JSON.stringify(mapSelect)}).dataset.value==='56f40101d2720b2a4d8b45d6' && !!(${background})`));
  const savedBounds=overlay.getBounds();overlay.setSize(380,320);await wait(700);
  const small=await overview();
  overlay.setBounds(savedBounds);await wait(700);await overview();
  const beforeZoom=await js(`(${background}).getBoundingClientRect().width`);
  await click("document.querySelector('[data-testid=map-zoom-out]')");
  await wait(350);
  const afterZoom=await js(`(${background}).getBoundingClientRect().width`);
  assert.ok(afterZoom<beforeZoom,'the overlay must allow zooming out beyond the full-map fit');
  await overview();
  checks.push('the smallest supported overlay can show the whole map with Follow disabled');
  fs.writeFileSync(path.join(root,'data/map-controls-result.json'),JSON.stringify({ok:true,views,small,beforeZoom,afterZoom,focusable:overlay.isFocusable(),focused:overlay.isFocused()},null,2));
  fs.writeFileSync(path.join(dataDir,'overview.png'),(await overlay.webContents.capturePage()).toPNG());
 }catch(error){
  const page=await js("({text:document.body.innerText.slice(0,2000),url:location.href})").catch(()=>null);
  error.message=stage+': '+error.message+' '+JSON.stringify(page);throw error;
 }finally{debug.detach();}
};
