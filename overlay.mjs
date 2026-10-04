import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import settings from './overlay-settings.cjs';
export const {validateOverlaySettings,validateOverlayOpacity}=settings;
const require=createRequire(import.meta.url);

export class Overlay {
  constructor(root,{port,onState,spawnWorker}={}) {
    this.root=root;this.port=port;this.onState=onState;this.pending=new Map();this.serial=0;
    this.spawnWorker=spawnWorker || (()=>{
      const env={...process.env,TARKOV_OVERLAY_PORT:String(port)};delete env.ELECTRON_RUN_AS_NODE;
      const packaged=!!process.env.TARKOV_PACKAGED_EXEC;
      return spawn(packaged?process.env.TARKOV_PACKAGED_EXEC:require('electron'),packaged?['--overlay-worker']:[path.join(root,'desktop/overlay.cjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
    });
    this.value={ready:false,visible:false,alwaysOnTop:false,hotkey:null,shortcutRegistered:false,error:null};
  }
  publish(value){this.value={...this.value,...value};this.onState(this.value);}
  start() {
    if(this.starting)return this.starting;
    this.starting=new Promise((resolve,reject)=>{
      let child;
      try{child=this.spawnWorker();this.child=child;}catch(e){reject(e);return;}
      const timer=setTimeout(()=>this.fail(new Error('置顶浮窗启动超时')),20000);
      this.startReject=reject;this.startTimer=timer;
      child.stderr.setEncoding('utf8');
      child.on('message',message=>{
        if(this.child!==child)return;
          if(message.kind==='ready'){clearTimeout(timer);this.startReject=null;this.publish(message.state);resolve();}
          if(message.kind==='state')this.publish(message.state);
          if(message.kind==='reply') {
            const request=this.pending.get(message.id);if(!request)return;
            clearTimeout(request.timer);this.pending.delete(message.id);
            if(message.error)request.reject(new Error(message.error));else request.resolve(message.state);
          }
          if(message.kind==='fatal')this.fail(new Error(message.error));
      });
      child.stderr.on('data',chunk=>{this.lastDiagnostic=String(chunk).slice(-500);});
      child.on('error',e=>{if(this.child===child)this.fail(e);});
      child.on('exit',()=>{if(this.child===child)this.fail(new Error('置顶浮窗已退出'));});
    }).catch(error=>{this.starting=null;this.publish({ready:false,error:error.message});throw error;});
    return this.starting;
  }
  async command(action,settings={}) {
    await this.start();
    return new Promise((resolve,reject)=>{
      const id=++this.serial;
      const timer=action==='choose-directory'?null:setTimeout(()=>{this.pending.delete(id);reject(new Error('置顶浮窗响应超时'));},5000);
      this.pending.set(id,{resolve,reject,timer});
      this.child.send({id,action,...settings},error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
    });
  }
  async configure(enabled,hotkey,opacity=100) {
    const config=validateOverlaySettings(enabled,hotkey,opacity);
    try{await this.command('configure',config);return config;}
    catch(error){this.publish({error:error.message});throw error;}
  }
  fail(error) {this.startReject?.(error);this.stop();this.publish({ready:false,visible:false,shortcutRegistered:false,error:error.message});}
  stop() {
    clearTimeout(this.startTimer);this.startReject=null;
    for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(new Error('置顶浮窗已停止'));}this.pending.clear();
    const child=this.child;this.child=null;this.starting=null;
    if(child){try{if(child.connected)child.send({action:'quit'},()=>{});}catch{}const timer=setTimeout(()=>{if(child.exitCode===null && child.signalCode===null)child.kill();},2000);timer.unref();}
  }
}
