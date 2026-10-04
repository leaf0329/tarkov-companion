import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
const scenes = {
  customs:'海关',bigmap:'海关',woods:'森林',factory_day:'工厂',factory_night:'工厂',factory4_day:'工厂',factory4_night:'工厂',
  shopping_mall:'立交桥',interchange:'立交桥',rezervbase:'储备站',rezerv_base:'储备站',reserve:'储备站',shoreline:'海岸线',lighthouse:'灯塔',city:'街区',laboratory_dark:'实验室',
  tarkovstreets:'街区',streets:'街区',sandbox:'中心区',sandbox_start:'中心区',sandbox_high:'中心区',laboratory:'实验室',labs:'实验室',labyrinth:'迷宫',terminal:'码头',icebreaker:'破冰船'
};
export function mapForScene(scene) {
  return scenes[scene.toLowerCase().replace(/_preset$/,'')] || null;
}
export function timestamp(text) {
  const m = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3})(?: ([+-]\d{2}:\d{2}))?/);
  return m ? Date.parse(`${m[1]}T${m[2]}${m[3] || '+08:00'}`) : null;
}
export class LogParser {
  constructor(emit) { this.emit=emit; this.pending=null; }
  line(line) {
    const at = timestamp(line);
    if (at !== null) {
      this.pending=null;
      const mode=line.match(/Session mode:\s*(\w+)/i);
      if (mode) this.emit({kind:'mode',value:mode[1].toLowerCase(),version:line.match(/\|([\d.]+)\|/)?.[1] || null,at});
      const profile=line.match(/(?:Select(?:ed)?Profile|PrepareSelectedProfileLocally|CompleteSelectedProfile) ProfileId:([a-f\d]+)/i);
      if(profile) this.emit({kind:'profile',value:profile[1],at});
      const scene=line.match(/scene preset path:maps\/([\w]+)\.bundle/i);
      if(scene) this.emit({kind:'map',value:mapForScene(scene[1]),scene:scene[1],at});
      if (/application\|(?:GameStarted|Game starting|TRACE-NetworkGameCreate)/i.test(line)) this.emit({kind:'raid',value:'战局中',at});
      if (/application\|(?:ShowScreen.*(?:MainMenu|Inventory)|HideScreen.*BattleUi)/i.test(line)) this.emit({kind:'raid',value:'大厅',at});
      if (/Got notification\s*\|\s*ChatMessageReceived/.test(line)) {
        const start=line.indexOf('{');
        this.pending={at,text:start>=0?line.slice(start):''};
      }
    } else if (this.pending) this.pending.text+=line+'\n';
    if(this.pending?.text) {
      if(this.pending.text.length>4*1024*1024) {this.pending=null;return;}
      try {
        const payload=JSON.parse(this.pending.text),m=payload.message;
        if (m && [10,11,12].includes(m.type)) {
          const id=m.templateId?.match(/^([a-f\d]{24})(?:\s|$)/i)?.[1];
          if(id) this.emit({kind:'quest',id,status:{10:'active',11:'failed',12:'completed'}[m.type],at:this.pending.at});
        }
        this.pending=null;
      } catch { /* A notification is often written across several lines. */ }
    }
  }
}
function filesIn(dir) {
  try {
    return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
      if(e.isDirectory() && /^log_/i.test(e.name)) return filesIn(path.join(dir,e.name));
      return e.isFile() && /(?:application|(?:push-)?notifications).*\.log$/i.test(e.name) ? [path.join(dir,e.name)] : [];
    });
  } catch{return [];}
}
export class LogReader {
  constructor(folder,onEvents,onStatus) {this.folder=folder;this.onEvents=onEvents;this.onStatus=onStatus;this.cursors=new Map();this.contexts=new Map();}
  history() {
    const records=[];
    for(const file of filesIn(this.folder)) {
      try {
        const stat=fs.statSync(file),events=[];
        if(stat.size>64*1024*1024){this.onStatus('日志文件超过 64MB，未导入：'+path.basename(file));continue;}
        const parser=new LogParser(e=>events.push({...e,folder:path.dirname(file)}));
        const decoder=new StringDecoder('utf8');
        const lines=decoder.write(fs.readFileSync(file)).split(/\r?\n/);
        const partial=lines.pop() || '';
        for(const l of lines) parser.line(l);
        this.cursors.set(file,{offset:stat.size,partial,parser,decoder});
        records.push(...events);
      }catch(e){this.onStatus('日志无法读取：'+e.code);}
    }
    records.sort((a,b)=>a.at-b.at || ({mode:0,profile:1,map:2,raid:3,quest:4}[a.kind]-{mode:0,profile:1,map:2,raid:3,quest:4}[b.kind]));
    this.dispatch(records,true);
    this.onStatus(fs.existsSync(this.folder)?`已读取 ${this.cursors.size} 个日志文件`:'日志目录不存在，请在设置中指定');
  }
  dispatch(events,historical=false) {
    const scoped=[];
    for(const e of events) {
      const context=this.contexts.get(e.folder) || {mode:null,profile:null};
      if(e.kind==='mode') {if(context.mode!==e.value)context.profile=null;context.mode=e.value;}
      if(e.kind==='profile') context.profile=e.value;
      this.contexts.set(e.folder,context);
      scoped.push({...e,mode:context.mode,profile:context.profile,historical});
    }
    if(scoped.length)this.onEvents(scoped);
  }
  poll() {
    const events=[];
    for(const file of filesIn(this.folder)) {
      let fd;
      try {
        const stat=fs.statSync(file);
        let c=this.cursors.get(file);
        if(!c || stat.size<c.offset) {
          const parser=new LogParser(e=>events.push({...e,folder:path.dirname(file)}));
          c={offset:0,partial:'',parser,decoder:new StringDecoder('utf8')};this.cursors.set(file,c);
        }
        // Historical parsers collect into their initial array; redirect for live appends.
        c.parser.emit=e=>events.push({...e,folder:path.dirname(file)});
        if(stat.size===c.offset)continue;
        fd=fs.openSync(file,'r');
        while(c.offset<stat.size) {
          const buf=Buffer.alloc(Math.min(256*1024,stat.size-c.offset));
          const count=fs.readSync(fd,buf,0,buf.length,c.offset);
          if(!count)break;c.offset+=count;
          const lines=(c.partial+c.decoder.write(buf.subarray(0,count))).split(/\r?\n/);
          c.partial=lines.pop() || '';for(const line of lines)c.parser.line(line);
        }
      }catch(e){this.onStatus('日志监听错误：'+e.code);}finally{if(fd!==undefined)fs.closeSync(fd);}
    }
    events.sort((a,b)=>a.at-b.at || ({mode:0,profile:1,map:2,raid:3,quest:4}[a.kind]-{mode:0,profile:1,map:2,raid:3,quest:4}[b.kind]));
    this.dispatch(events);
  }
}
