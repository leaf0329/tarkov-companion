const {app,BrowserWindow,dialog,Menu,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {pathToFileURL}=require('node:url');
const {createDecipheriv}=require('node:crypto');
const {gunzipSync}=require('node:zlib');

if(process.argv.includes('--overlay-worker')){
  require(path.join(process.env.TARKOV_RUNTIME_ROOT,'desktop/overlay.cjs'));
}else{
  const portableDir=process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const smokeTest=process.argv.includes('--smoke-test');
  const dataDir=smokeTest?fs.mkdtempSync(path.join(os.tmpdir(),'tarkov-smoke-')):path.join(portableDir,'助手数据');
  let mainWindow,runtimeRoot,service,quitting=false;
  fs.mkdirSync(dataDir,{recursive:true});
  app.setPath('userData',path.join(dataDir,'浏览器缓存'));
  app.setPath('sessionData',path.join(dataDir,'浏览器缓存'));
  if(!app.requestSingleInstanceLock()){app.quit();}
  else{
    app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
    app.whenReady().then(async()=>{
      Menu.setApplicationMenu(null);
      const blob=fs.readFileSync(path.join(__dirname,'payload.bin'));
      const decrypt=createDecipheriv('aes-256-gcm',Buffer.from('__PAYLOAD_KEY__','base64'),blob.subarray(0,12));
      decrypt.setAuthTag(blob.subarray(12,28));
      const files=JSON.parse(gunzipSync(Buffer.concat([decrypt.update(blob.subarray(28)),decrypt.final()])).toString('utf8'));
      runtimeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'tarkov-personal-'));
      for(const [relative,encoded] of Object.entries(files)){
        const destination=path.resolve(runtimeRoot,relative);
        if(!destination.startsWith(path.resolve(runtimeRoot)+path.sep))throw Error('资源路径无效');
        fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,Buffer.from(encoded,'base64'));
      }
      process.env.TARKOV_RUNTIME_ROOT=runtimeRoot;
      process.env.TARKOV_PACKAGED_EXEC=process.execPath;
      process.env.TARKOV_OVERLAY_CACHE=path.join(dataDir,'浮窗设置');
      process.env.TARKOV_STATE_PATH=path.join(dataDir,'state.json');
      if(!fs.existsSync(process.env.TARKOV_STATE_PATH)){
        const candidates=['C:/Battlestate Games/EFT/Logs','C:/Battlestate Games/Escape from Tarkov/Logs'];
        const logsPath=smokeTest?path.join(dataDir,'Logs'):candidates.find(p=>fs.existsSync(p)) || path.join(app.getPath('documents'),'Escape from Tarkov','Logs');
        const screenshotsPath=smokeTest?path.join(dataDir,'Screenshots'):path.join(app.getPath('documents'),'Escape from Tarkov','Screenshots');
        if(smokeTest){fs.mkdirSync(logsPath);fs.mkdirSync(screenshotsPath);}
        fs.writeFileSync(process.env.TARKOV_STATE_PATH,JSON.stringify({settings:{logsPath,screenshotsPath,autoScreenshotEnabled:false,screenshotCleanupEnabled:false,overlayHotkeyEnabled:!smokeTest},profiles:{},selectedProfile:null}));
      }
      let port;
      for(let candidate=18765;candidate<18785;candidate++){
        if(await new Promise(resolve=>{const probe=net.createServer();probe.once('error',()=>resolve(false));probe.listen(candidate,'127.0.0.1',()=>probe.close(()=>resolve(true)));})){port=candidate;break;}
      }
      if(!port)throw Error('本机助手端口均已占用');
      process.env.TARKOV_PORT=String(port);
      service=await import(pathToFileURL(path.join(runtimeRoot,'server.mjs')).href);
      const origin='http://127.0.0.1:'+port;
      for(let i=0;i<80;i++){
        try{if((await fetch(origin+'/api/state')).ok)break;}catch{}
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      mainWindow=new BrowserWindow({width:1480,height:940,minWidth:780,minHeight:580,title:'leaf0329 · 塔科夫个人助手',backgroundColor:'#15191e',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}});
      mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
      mainWindow.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
      if(!smokeTest)mainWindow.once('ready-to-show',()=>mainWindow.show());
      await mainWindow.loadURL(origin+'/');
      if(smokeTest){
        try{
          const checks=await require(path.join(runtimeRoot,'desktop/portable-smoke.cjs'))({mainWindow,origin,dataDir,BrowserWindow});
          fs.writeFileSync(path.join(portableDir,'portable-smoke-result.json'),JSON.stringify({ok:true,checks,runtimeRoot,dataDir},null,2));
        }catch(error){fs.writeFileSync(path.join(portableDir,'portable-smoke-result.json'),JSON.stringify({ok:false,error:error.stack},null,2));}
        app.quit();
      }
    }).catch(error=>{if(smokeTest)fs.writeFileSync(path.join(portableDir,'portable-smoke-result.json'),JSON.stringify({ok:false,error:error.stack}));else dialog.showErrorBox('助手启动失败',error.message);app.quit();});
    app.on('window-all-closed',()=>app.quit());
    app.on('before-quit',event=>{
      if(quitting)return;event.preventDefault();quitting=true;service?.shutdown();
      setTimeout(()=>{
        if(runtimeRoot){
          const resolved=path.resolve(runtimeRoot),temp=path.resolve(os.tmpdir());
          if(resolved.startsWith(temp+path.sep) && path.basename(resolved).startsWith('tarkov-personal-')){try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}}
        }
        app.quit();
      },2300);
    });
  }
}
