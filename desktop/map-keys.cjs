const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({main,overlay,store,dataDir,publish,wait,until,checks})=>{
 const profile=store.disk.selectedProfile;
 const quests=[
  {id:'59689fbd86f7740d137ebfc4',name:'水瓶座行动',required:'宿舍206房间钥匙'},
  {id:'5967725e86f774601a446662',name:'探囊取物',required:'宿舍203房间钥匙',optional:'宿舍214房间钥匙'},
 ];
 for(const quest of quests){
  store.event({kind:'quest',id:quest.id,profile,status:'active',at:Date.now(),history:false});publish();
  for(const window of [main,overlay]){
   const js=code=>window.webContents.executeJavaScript(code);
   const name=JSON.stringify(quest.name),required=JSON.stringify(quest.required);
   await until(()=>js(`Array.from(document.querySelectorAll('.companion-task-marker')).some(m=>m.textContent.includes(${name}))`));
   await js(`Array.from(document.querySelectorAll('.companion-task-marker')).find(m=>m.textContent.includes(${name})).click()`);
   await until(()=>js(`document.querySelector('[data-testid="objective-required-keys"]')?.textContent.includes(${required})`));
   const result=await js(`(()=>{
    const probe=document.createElement('span');document.body.append(probe);
    const colors=['--color-amber-100','--color-amber-200'].map(token=>{probe.style.color='var('+token+')';return getComputedStyle(probe).color});probe.remove();
    const rows=Array.from(document.querySelectorAll('[data-testid="objective-key-group"]'),r=>({text:r.textContent,optional:r.dataset.optional,links:Array.from(r.querySelectorAll('a'),a=>({href:a.href,target:a.target,rel:a.rel,color:getComputedStyle(a).color}))}));
    return {rows,colors};
   })()`);
   const rows=result.rows;
   const mandatory=rows.find(r=>r.text.includes(quest.required));
   assert.equal(mandatory.optional,'false');assert.ok(mandatory.text.includes('必需'));
   assert.ok(mandatory.links.every(a=>a.target==='_blank' && a.rel.includes('noopener') && new URL(a.href).protocol==='https:'));
   assert.ok(mandatory.links.every(a=>result.colors.includes(a.color)),'key names must retain readable colors inside Leaflet popups');
   if(quest.optional){
    const optional=rows.find(r=>r.text.includes(quest.optional));
    assert.equal(optional.optional,'true');assert.ok(optional.text.includes('可选目标'));
   }
   if(quest.optional && window===overlay){
    main.hide();overlay.showInactive();await wait(300);
    fs.writeFileSync(path.join(dataDir,'keys-popup.png'),(await overlay.webContents.capturePage()).toPNG());
   }
   await js("document.querySelector('[data-testid=objective-close-button]').click()");
  }
  store.event({kind:'quest',id:quest.id,profile,status:'completed',at:Date.now()+1,history:false});publish();
  await until(()=>main.webContents.executeJavaScript("document.querySelectorAll('.companion-task-marker').length===0"));
 }
 checks.push('official PvE task keys show full Chinese names and trusted links in main and overlay map popups');
 checks.push('task popup includes other goals and distinguishes optional Dorm 214 key from required Dorm 203 key');
};
