function attachExternalLinks(contents,{shell,onError,localUrl}) {
  const open=target=>{
    try{
      if(new URL(target).protocol!=='https:')return;
      Promise.resolve(shell.openExternal(target)).catch(error=>onError(error));
    }catch(error){onError(error);}
  };
  contents.setWindowOpenHandler(({url})=>{open(url);return {action:'deny'};});
  contents.on('will-navigate',(event,target)=>{if(target!==localUrl){event.preventDefault();open(target);}});
}
async function chooseDirectory(dialog,{title,defaultPath}) {
  const result=await dialog.showOpenDialog({title,defaultPath,properties:['openDirectory']});
  return {canceled:result.canceled,path:result.canceled?null:result.filePaths[0] || null};
}
module.exports={attachExternalLinks,chooseDirectory};
