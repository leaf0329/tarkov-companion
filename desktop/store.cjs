const fs=require('node:fs'),path=require('node:path');
const {isDeepStrictEqual}=require('node:util');
class LocalStore {
  constructor(root,data=path.join(root,'data')){this.root=root;this.file=path.join(data,'companion.json');this.disk=JSON.parse(fs.readFileSync(this.file));this.progressRevision=1;this.runtime={ready:false,mode:null,map:null,profile:null,raid:'lobby',position:null,error:null};}
  profile(id=this.disk.selectedProfile){return this.disk.profiles[id] ||= {tasks:{},objectives:{},ui:{}};}
  save(){const next=this.file+'.tmp';fs.writeFileSync(next,JSON.stringify(this.disk,null,2));fs.renameSync(next,this.file);}
  snapshot(includeProgress=true){const state={settings:this.disk.settings,profile:this.disk.selectedProfile,progressRevision:this.progressRevision,runtime:this.runtime};if(includeProgress){const p=this.disk.selectedProfile?this.profile():{tasks:{},ui:{}};state.progress=p.tasks;state.ui=p.ui || {};}return state;}
  event(e){
    if(e.kind==='ready'){this.runtime.ready=true;this.runtime.error=null;}
    if(e.kind==='error'){this.runtime.error=e.context+': '+e.message;}
    if(e.kind==='profile' && !e.history){
      if(this.runtime.profile!==e.profile || this.runtime.mode!==e.mode){this.runtime.map=null;this.runtime.position=null;this.runtime.raid='lobby';}
      this.runtime.profile=e.profile;this.runtime.mode=e.mode;
      if(e.mode==='pve' && e.profile){if(this.disk.selectedProfile!==e.profile)this.progressRevision++;this.disk.selectedProfile=e.profile;this.profile(e.profile);}
    }
    if(e.kind==='quest' && /^[a-f\d]{24}$/i.test(e.id)){
      const p=this.profile(e.profile),old=p.tasks[e.id];
      if(!old || e.at>old.at){p.tasks[e.id]={status:e.status,at:e.at,source:'TarkovMonitor'};this.progressRevision++;this.save();}
    }
    if(e.kind==='map' && !e.history && ['pve','pvp','pvp-season'].includes(e.mode) && e.mode===this.runtime.mode && e.profile===this.runtime.profile){this.runtime.map=e.map;this.runtime.position=null;}
    if(e.kind==='raid' && !e.history){this.runtime.raid=e.value;if(e.value==='lobby')this.runtime.position=null;}
    if(e.kind==='position' && ['pve','pvp','pvp-season'].includes(e.mode) && e.mode===this.runtime.mode && e.profile===this.runtime.profile){this.runtime.map=e.map;this.runtime.raid='raid';this.runtime.position=e;}
  }
  saveUI({profile,state,revision}){
    if(profile!==this.disk.selectedProfile)throw Error('角色已切换，请重试');
    if(!state || !state.pve || JSON.stringify(state).length>1024*1024)throw Error('进度数据无效');
    if(revision!==undefined && (!Number.isSafeInteger(revision) || revision<0))throw Error('进度版本无效');
    const p=this.profile(),stale=revision!==undefined && revision<this.progressRevision;
    // An older window may still be saving its initial UI after another window
    // completes a goal. Keep newer goal records; an explicit newer uncheck wins.
    for(const [id,previous] of Object.entries(p.ui?.pve?.taskObjectives || {})){
      const next=state.pve.taskObjectives?.[id];
      if((!next && stale) || (next && previous.timestamp>next.timestamp)){
        (state.pve.taskObjectives ||= {})[id]=previous;
      }
    }
    if(isDeepStrictEqual(p.ui,state))return false;p.ui=state;
    for(const [id,value] of Object.entries(state.pve.taskCompletions || {})){
      if(!/^[a-f\d]{24}$/i.test(id) || !value || typeof value!=='object')continue;
      const old=p.tasks[id],at=value.timestamp || 0;
      if(old && old.at>=at)continue;
      const status=value.failed?'failed':value.complete?'completed':'active';
      p.tasks[id]={status,at,source:'manual'};
    }
    this.progressRevision++;this.save();return true;
  }
}
module.exports={LocalStore};
