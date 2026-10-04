import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import shared from './vendor/tarkov-data-overlay/tarkov-api-shared.cjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const ref=v=>typeof v==='string'?v:v?.id;
const clean=s=>s.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi,'').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g,'$1').replace(/<[^>]*>/g,'').replace(/'{2,}/g,'').replace(/\{\{PAGENAME\}\}/g,'').replace(/^[*: =]+|[= ]+$/g,'').replace(/\s+/g,' ').trim();
const comparable=s=>clean(s).toLowerCase().replace(/\(optional\)/g,'').replace(/[^\p{L}\p{N}]+/gu,'');
const mapNames={'Customs':'海关','Woods':'森林','Factory':'工厂','Interchange':'立交桥','Shoreline':'海岸线','Reserve':'储备站','Lighthouse':'灯塔','Streets of Tarkov':'街区','Ground Zero':'中心区','The Lab':'实验室','The Labyrinth':'迷宫','Terminal':'码头','Icebreaker':'破冰船'};
export function mergeTask(base,patch) {
  const {objectives,objectivesAdd,traderRequirements,...fields}=patch;
  const result={...base,...fields};
  result.objectives=(base.objectives || []).map(o=>({...o,...objectives?.[o.id]}));
  for(const o of objectivesAdd || [])if(!result.objectives.some(a=>a.id===o.id))result.objectives.push(o);
  if(traderRequirements!==undefined){
    const byId=new Map((base.traderRequirements || []).map(r=>[r.id,r]));
    for(const r of traderRequirements)byId.set(r.id,{...byId.get(r.id),...r});
    const semantic=new Map([...byId.values()].map(r=>[[ref(r.trader),r.requirementType,r.compareMethod,r.value].join('|'),r]));
    result.traderRequirements=traderRequirements.length?[...semantic.values()]:[];
  }
  return result;
}
export function parseWikiGuide(record,chapter,translations={}) {
  if(!record)return [];
  const section=/==\s*Objectives\s*==([\s\S]*?)(\n==[^=]|$)/.exec(record.wikitext)?.[1];
  if(!section)return [];
  let sectionTitle='',branchTitle='';const occurrences=new Map(),entries=[];
  for(const raw of section.split('\n')){
    const line=raw.trim();if(!line)continue;
    if(/^<hr\b/i.test(line)){sectionTitle='';branchTitle='';continue;}
    if(!line.startsWith('*')){
      if(line.startsWith('=')){sectionTitle=clean(line);branchTitle='';}
      else if(line.startsWith("'''"))branchTitle=clean(line);
      continue;
    }
    const text=clean(line),key=comparable(text),occurrence=(occurrences.get(key)||0)+1;occurrences.set(key,occurrence);
    const candidates=chapter.objectives.filter(o=>comparable(o.description)===key);
    const matched=candidates.length===1?candidates[0]:null;
    const context=[sectionTitle,branchTitle].filter(Boolean).join(' · ');
    entries.push({id:'guide:'+chapter.id+':'+createHash('sha256').update(key+'|'+occurrence).digest('hex').slice(0,16),
      description:translations[key] || text,original:text,context,optional:/\(optional\)/i.test(text),depth:line.match(/^\*+/)[0].length,
      objectiveId:matched?.id || null,sourceQuestId:matched?.sourceQuestId || null});
  }
  return entries;
}
export function loadSupplements(root,rawTasks,items) {
  const dir=path.join(root,'data/community');
  if(!fs.existsSync(path.join(dir,'provenance.json')))return {tasks:rawTasks,storyTasks:[],metadata:null};
  const bundle=fs.existsSync(path.join(dir,'bundle.json'))?read(path.join(dir,'bundle.json')):null;
  const overlay=bundle?.overlay || read(path.join(dir,'overlay.json')),upstream=bundle?.upstream || read(path.join(dir,'tasks.json')).data.tasks;
  const zh=bundle?.zh || read(path.join(dir,'tasks_zh.json')).data,en=bundle?.en || read(path.join(dir,'tasks_en.json')).data;
  const mapsZh=bundle?.mapsZh || read(path.join(dir,'maps_zh.json')).data,wiki=bundle?.wiki || read(path.join(dir,'wiki.json'));
  const guideZh=fs.existsSync(path.join(dir,'guide-zh.json'))?read(path.join(dir,'guide-zh.json')):{};
  const translated=new Map();
  for(const [id,text] of Object.entries(en))if(typeof text==='string' && typeof zh[id]==='string'){
    const key=comparable(text),values=translated.get(key)||new Set();values.add(zh[id]);translated.set(key,values);
  }
  const textTranslations=Object.fromEntries([...translated].filter(([,v])=>v.size===1).map(([k,v])=>[k,[...v][0]]));
  const names=new Map(rawTasks.map(q=>[q.id,q.name]));
  for(const q of rawTasks)names.set(q.traderId,q.trader);
  const refs=new Set(['map','maps','task','trader','item','items','markerItem','questItem','usingWeapon','usingWeaponMods','requiredKeys','wearing','notWearing','containsAll','containsCategory','useAny']);
  function hydrate(value,key='') {
    if(Array.isArray(value))return value.map(v=>hydrate(v,key));
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hydrate(v,k)]));
    if(typeof value!=='string')return value;
    if(refs.has(key) && /^[a-f0-9]{24}$/.test(value))return {id:value,name:names.get(value)||items[value]?.name||mapsZh[value+' Name']||zh[value+' name']||value};
    if(['description','name','shortName'].includes(key))return zh[value]||value;
    return value;
  }
  const corrections=[];
  const tasks=rawTasks.map(local=>{
    const current=upstream[local.id];
    let base=current?{...local,...hydrate(current),name:zh[current.name]||local.name,trader:local.trader,traderId:local.traderId,map:local.map,mapId:ref(current.map)||local.mapId}:local;
    const patch=shared.mergeTaskOverride(overlay.tasks?.[local.id],overlay.modes?.pve?.tasks?.[local.id]);
    // This patch supplied a formerly empty zone. Current PvE supplies both alternatives.
    if(local.id==='5ae448f286f77448d73c0131' && base.objectives?.find(o=>o.id==='5ae452de86f77450595c4333')?.zones?.length){
      if(patch.objectives?.['5ae452de86f77450595c4333'])delete patch.objectives['5ae452de86f77450595c4333'].zones;
    }
    const corrected=mergeTask(base,patch);
    corrected.name=zh[current?.name] || local.name;
    for(const o of corrected.objectives){
      const localized=zh[o.id];
      if(localized)o.description=localized;
      else if(textTranslations[comparable(o.description || '')])o.description=textTranslations[comparable(o.description)];
    }
    corrected.communityPatched=Object.keys(patch).length>0;
    corrected.otherRequirements=(corrected.otherRequirements || []).map(r=>({...r,counter:r.type==='globalVariable'?overlay.progressionCounters?.pve?.[r.variableId]:undefined}));
    if(corrected.communityPatched)corrections.push(local.id);
    return corrected;
  });
  const chapterIds=Object.fromEntries(Object.values(overlay.storyChapters).map(c=>[c.id,c.chapterQuestId]));
  const storyTasks=Object.values(overlay.storyChapters).sort((a,b)=>a.order-b.order).map(c=>{
    const name=zh[c.chapterQuestId+' name'] || c.name;
    const objectives=c.objectives.map(o=>({...o,original:o.description,description:zh[o.id]||o.description,optional:o.type==='optional',
      relatedMaps:Object.entries(mapNames).filter(([name])=>new RegExp('\\b'+name+'\\b').test(o.description)).map(([,name])=>name)}));
    const guide=parseWikiGuide(wiki[c.id],c,textTranslations).map(s=>({...s,description:guideZh[s.original] || s.description,context:guideZh[s.context] || s.context}));
    const groups=[...new Set(objectives.map(o=>o.sourceQuestId))];
    return {id:c.chapterQuestId,name,trader:'Story',traderId:'story',map:'多张地图',minPlayerLevel:0,
      normalizedName:c.normalizedName,wikiLink:c.wikiLink,kind:'story',chapterId:c.id,order:c.order,
      taskRequirements:(c.chapterRequirements || []).map(r=>({task:{id:chapterIds[r.id],name:r.name},status:['complete']})),
      objectives,story:{...c,name,objectives:undefined,guide,groups,guideRevision:wiki[c.id]?.revision,
        activation:guideZh[c.activation?.summary || c.description] || c.activation?.summary || c.description,partial:c.referenceCoverage?.partial || false},
      traderRequirements:[],factionName:'Any',communityPatched:true};
  });
  const references=fs.existsSync(path.join(dir,'wiki-tasks.json'))?read(path.join(dir,'wiki-tasks.json')).tasks:[];
  for(const q of references){
    const latest=wiki[q.id]?.wikitext;
    if(latest && /\{\{(?:Event content|Removed content|Removed quest)/i.test(latest)){
      q.disabled=true;q.reference.note='更新资料已将此任务标记为活动或移除内容，等待时效复核；不进入当前任务树。';
    }
    q.traderId=tasks.find(t=>t.trader===q.trader)?.traderId;
    for(const r of q.traderRequirements)r.trader.id=q.traderId;
  }
  const acquainted=tasks.find(q=>q.id==='625d700cc48e6c62a440fab5');
  const otherSide=references.find(q=>q.normalizedName==='to-the-light-the-other-side');
  if(acquainted && otherSide){
    acquainted.name='通往灯塔 — 邂逅';
    acquainted.taskRequirements=[{task:{id:otherSide.id,name:otherSide.name},status:['complete']}];
    acquainted.wikiLink='https://escapefromtarkov.fandom.com/wiki/To_the_Light_-_Getting_Acquainted';
    const information=tasks.find(q=>q.id==='63966faeea19ac7ed845db2c');
    if(information)information.taskRequirements=[{task:{id:acquainted.id,name:acquainted.name},status:['complete']}];
  }
  return {tasks:[...tasks,...references],storyTasks,metadata:{...(bundle?.provenance || read(path.join(dir,'provenance.json'))),correctedTasks:corrections.length,referenceTasks:references.length,
    disabledTasks:[...tasks,...references].filter(q=>q.disabled).length,storyChapters:storyTasks.length,
    storyObjectives:storyTasks.reduce((n,q)=>n+q.objectives.length,0),guideSteps:storyTasks.reduce((n,q)=>n+q.story.guide.length,0)}};
}
