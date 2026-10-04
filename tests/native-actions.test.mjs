import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import actions from '../desktop/native-actions.cjs';

test('overlay Wiki links go to the system browser while the overlay keeps its page',async()=>{
  const contents=new EventEmitter(),opened=[],errors=[];let handler;
  contents.setWindowOpenHandler=fn=>handler=fn;
  actions.attachExternalLinks(contents,{shell:{openExternal:async url=>opened.push(url)},localUrl:'http://127.0.0.1:18765/?overlay=1',onError:e=>errors.push(e)});
  const wiki='https://escapefromtarkov.fandom.com/wiki/Debut';
  assert.deepEqual(handler({url:wiki}),{action:'deny'});assert.deepEqual(opened,[wiki]);
  for(const url of ['file:///C:/Windows','javascript:alert(1)','http://example.com'])handler({url});
  assert.equal(opened.length,1);
  let prevented=false;contents.emit('will-navigate',{preventDefault:()=>prevented=true},wiki);
  assert.ok(prevented);assert.equal(opened.length,2);assert.equal(errors.length,0);
});

test('native directory picker requests folders and cancellation preserves the input',async()=>{
  let options;
  const dialog={showOpenDialog:async o=>{options=o;return {canceled:false,filePaths:['D:/游戏/Logs']};}};
  assert.deepEqual(await actions.chooseDirectory(dialog,{title:'选择日志目录',defaultPath:'D:/游戏'}),{canceled:false,path:'D:/游戏/Logs'});
  assert.deepEqual(options,{title:'选择日志目录',defaultPath:'D:/游戏',properties:['openDirectory']});
  dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});
  assert.deepEqual(await actions.chooseDirectory(dialog,{}),{canceled:true,path:null});
});
