import path from 'node:path';
import { spawn } from 'node:child_process';

export function validateAutoScreenshot(enabled,intervalSeconds) {
  if(typeof enabled!=='boolean' || !Number.isInteger(intervalSeconds) || intervalSeconds<1 || intervalSeconds>300)throw new Error('自动截图间隔须为 1～300 的整数秒');
  return {autoScreenshotEnabled:enabled,autoScreenshotInterval:intervalSeconds};
}
const messages={off:'自动截图已关闭',starting:'正在启动按键助手',waiting:'等待塔科夫前台窗口',
  'paused-context':'等待当前 PvE 角色与地图日志','paused-background':'已暂停：塔科夫不在前台',
  'paused-keys':'已暂停：正在按住修饰键或 Insert',sent:'已发出 Insert 按键，等待游戏截图',
  'dry-run':'测试模式：未发送按键',error:'按键助手错误，请关闭后重新开启'};

export class AutoScreenshot {
  constructor(root,{getContext,onState,now=Date.now,spawnWorker}={}) {
    this.getContext=getContext;this.onState=onState;this.now=now;
    this.spawnWorker=spawnWorker || (()=>spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/screenshot-key.ps1'),...(process.env.TARKOV_INPUT_DRY_RUN==='1'?['-DryRun']:[])],{windowsHide:true,stdio:['pipe','pipe','pipe']}));
    this.config={autoScreenshotEnabled:false,autoScreenshotInterval:5};
    this.lastPressAt=null;this.sentCount=0;this.child=null;
  }
  publish(phase,error=null) {
    this.onState({enabled:this.config.autoScreenshotEnabled,intervalSeconds:this.config.autoScreenshotInterval,key:'Insert',phase,
      message:messages[phase] || phase,error,lastPressAt:this.lastPressAt,sentCount:this.sentCount,nextCheckAt:this.config.autoScreenshotEnabled?this.nextDue:null});
  }
  configure(enabled,seconds) {
    this.config=validateAutoScreenshot(enabled,seconds);this.nextDue=this.now()+seconds*1000;
    if(!enabled){this.stop();this.publish('off');return;}
    if(this.child){this.publish(this.ready?'waiting':'starting');return;}
    this.ready=false;this.busy=false;this.buffer='';this.publish('starting');
    try {
      const child=this.spawnWorker();this.child=child;
      child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
      child.stdout.on('data',chunk=>{
        if(this.child!==child)return;
        this.buffer+=chunk;
        const lines=this.buffer.split(/\r?\n/);this.buffer=lines.pop();
        for(const line of lines)if(line.trim()) {
          try {
            const message=JSON.parse(line);
            if(message.kind==='ready'){clearTimeout(this.startupTimer);this.ready=true;this.nextDue=this.now()+this.config.autoScreenshotInterval*1000;this.publish('waiting');}
            if(message.kind==='result'){
              this.busy=false;
              if(message.phase==='error'){this.fail(message.error);return;}
              if(message.phase==='sent'){this.lastPressAt=this.now();this.sentCount++;}
              this.publish(message.phase);
            }
          }catch{this.fail('按键助手返回了无法识别的数据');return;}
        }
      });
      child.stderr.on('data',chunk=>{if(this.child===child)this.fail(String(chunk).slice(0,400));});
      child.on('error',error=>{if(this.child===child)this.fail(error.message);});
      child.stdin.on('error',error=>{if(this.child===child)this.fail(error.message);});
      child.on('exit',()=>{if(this.child===child)this.fail('按键助手已退出');});
      this.startupTimer=setTimeout(()=>{if(!this.ready)this.fail('按键助手启动超时');},15000);this.startupTimer.unref?.();
      this.timer=setInterval(()=>this.tick(),250);this.timer.unref?.();
    }catch(error){this.fail(error.message);}
  }
  tick() {
    if(!this.ready || !this.config.autoScreenshotEnabled)return;
    const at=this.now();
    if(this.busy){if(at-this.requestAt>5000)this.fail('按键助手响应超时');return;}
    if(at<this.nextDue)return;
    this.nextDue=at+this.config.autoScreenshotInterval*1000;
    const context=this.getContext();
    if(context.mode!=='pve' || !context.map || !context.profile || context.profile!==context.selectedProfile){this.publish('paused-context');return;}
    this.busy=true;this.requestAt=at;this.child.stdin.write('press\n');
  }
  fail(error){this.stop();this.publish('error',error);}
  stop() {
    clearInterval(this.timer);clearTimeout(this.startupTimer);this.ready=false;this.busy=false;
    const child=this.child;this.child=null;
    // Let an in-flight key press release before ending the helper process.
    if(child){child.stdin.end('stop\n');const timer=setTimeout(()=>{if(child.exitCode===null)child.kill();},2000);timer.unref?.();}
  }
}
