const assert=require('node:assert/strict'),fs=require('node:fs');
const {LocalStore}=require('./store.cjs');
module.exports=async({main,overlay,store,dataDir,origin,publish,wait,until,checks})=>{
 const js=code=>main.webContents.executeJavaScript(code);
 const original=JSON.parse(JSON.stringify(store.disk.settings));
 store.disk.settings.overlayBounds=overlay.getBounds();store.save();publish();
 await main.loadURL(origin+'/companion-settings');
 await until(()=>js("!!document.querySelector('form button[type=submit]') && !!document.querySelector('form input[type=number]')"));
 const bounds=overlay.getBounds();overlay.setBounds({...bounds,x:bounds.x+8,y:bounds.y+8});await wait(600);
 const currentBounds=overlay.getBounds();
 await overlay.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('跟随')).click()");
 await until(()=>store.disk.settings.follow!==original.follow);
 const expected={logsPath:original.logsPath,screenshotsPath:original.screenshotsPath,hotkey:original.hotkey,interval:7,opacity:72,autoScreenshot:true,cleanupScreenshots:true};
 const submit=async(value)=>{
  await js(`(()=>{
   const value=${JSON.stringify(value)},form=document.querySelector('form'),inputs=Array.from(form.querySelectorAll('input'));
   const text=inputs.filter(i=>i.type==='text'),checkboxes=inputs.filter(i=>i.type==='checkbox');
   const input=(el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))};
   const check=(el,value)=>{el.checked=value;el.dispatchEvent(new Event('change',{bubbles:true}))};
   input(text[0],value.logsPath);input(text[1],value.screenshotsPath);
   input(inputs.find(i=>i.type==='number'),value.interval);input(inputs.find(i=>i.type==='range'),value.opacity);
   check(checkboxes[0],value.autoScreenshot);check(checkboxes[1],value.cleanupScreenshots);
   const select=form.querySelector('select');select.value=value.hotkey;select.dispatchEvent(new Event('change',{bubbles:true}));
   form.querySelector('button[type=submit]').click();
  })()`);
  await until(async()=>{
   const text=await js("document.querySelector('form').innerText");
   if(text.includes('Error:'))throw Error('Settings form failed: '+text.split('\n').find(line=>line.includes('Error:')));
   return text.includes('设置已保存') && Object.entries(value).every(([key,value])=>store.disk.settings[key]===value);
  });
 };
 await submit(expected);
 assert.equal(Math.round(overlay.getOpacity()*100),72);
 assert.deepEqual(store.disk.settings.overlayBounds,currentBounds);
 assert.equal(store.disk.settings.follow,!original.follow);
 checks.push('real settings form saves after moving the overlay and preserves current window bounds and toolbar follow state');
 const saved=JSON.parse(fs.readFileSync(store.file)).settings;
 const reopened=new LocalStore(store.root,dataDir).disk.settings;
 for(const [key,value] of Object.entries(expected)){assert.equal(saved[key],value);assert.equal(reopened[key],value);}
 await main.reload();
 await until(()=>js("document.querySelector('form input[type=number]')?.value==='7' && document.querySelector('form input[type=range]')?.value==='72'"));
 assert.equal(await js("Array.from(document.querySelectorAll('form input[type=checkbox]')).every(i=>i.checked)"),true);
 checks.push('saved form settings survive both a fresh store load and renderer restart');
 await submit(Object.fromEntries(Object.keys(expected).map(key=>[key,original[key]])));
 await overlay.webContents.executeJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('跟随')).click()");
 await until(()=>store.disk.settings.follow===original.follow);
 await main.loadURL(origin+'/companion-map');
 await until(()=>js("document.querySelectorAll('.leaflet-container').length>0 && document.querySelectorAll('aside a').length>0"));
};
