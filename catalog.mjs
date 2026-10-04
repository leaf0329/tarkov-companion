import fs from 'node:fs';
import path from 'node:path';
import {loadSupplements} from './supplements.mjs';
export const traderNames = { Prapor:'俄商',Therapist:'大妈',Skier:'配件商',Peacekeeper:'美商',Mechanic:'机械师',Ragman:'服装商',Jaeger:'耶格',Fence:'黑商',Lightkeeper:'灯塔商人',Ref:'竞技场裁判','BTR Driver':'BTR司机',Taran:'塔兰' };
const canonicalTrader = name => ({'BTR司机':'BTR Driver','竞技场裁判':'Ref'}[name] || name);
const read = p => JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
export function loadCatalog(root) {
  const data = path.join(root,'data'), toolbox = path.join(data,'toolbox');
  const items = read(path.join(data,'item-names.json'));
  function enrichObjective(o) {
    return {...o,requiredKeys:(o.requiredKeys || []).map(group=>(Array.isArray(group)?group:[group]).map(k=>({...k,name:k.name || items[k.id]?.name || items[k.id]?.shortName || k.id})))};
  }
  const current = read(path.join(data,'current-tasks.json')).data.data;
  const rawTasks = current.map(q => {
    const detailPath = path.join(data,'details',`${q.id}.json`);
    if(!fs.existsSync(detailPath))throw new Error(`正式版任务详情缺失：${q.id}，请运行更新任务数据。`);
    const d=read(detailPath);
    return {...d,trader:canonicalTrader(q.trader),traderId:q.traderId,map:d.map || q.map,mapId:d.mapId || q.mapId};
  });
  const supplemented=loadSupplements(root,rawTasks,items);
  const tasks = [...supplemented.tasks,...supplemented.storyTasks].map(d => {
    const q=d;
    return {
      id:q.id, name:d.name, trader:canonicalTrader(q.trader), traderId:q.traderId, map:d.map || q.map,
      mapId:d.mapId || q.mapId, level:d.minPlayerLevel ?? 0,
      wiki:d.wikiLink, kappa:d.kappaRequired, lightkeeper:d.lightkeeperRequired,
      normalizedName:d.normalizedName || d.name,
      requirements:(d.taskRequirements || []).map(r=>({id:r.task.id,name:r.task.name,status:r.status || ['complete']})),
      traderRequirements:d.traderRequirements || [],faction:d.factionName || 'Any',
      objectives:(d.objectives || []).map(enrichObjective),detailSource:d.reference?'wiki-reference':'current',reference:d.reference || null,
      disabled:!!d.disabled,kind:d.kind || 'trader',story:d.story || null,order:d.order || 0,
      otherRequirements:d.otherRequirements || [],taskRequirementGroups:d.taskRequirementGroups || [],
      waitMin:d.availableDelaySecondsMin || 0,waitMax:d.availableDelaySecondsMax || 0,
      failConditions:d.failConditions || [],restartable:!!d.restartable,communityPatched:!!d.communityPatched
    };
  });
  const mapsRaw = read(path.join(toolbox,'map_地图数据.json'))['地图列表'];
  const maps = Object.entries(mapsRaw).map(([name,m])=>({
    name, note:name==='灯塔'?'灯塔底图为 2025-11-29 文件，尚未反映 1.1.5 的地形改动。':'', layers:m['楼层列表'].map((l,i)=>({index:i,name:l['名称'],min:l['最小高度'],max:l['最大高度'],matrix:l['定位矩阵'],tps:l['薄板样条'],
      image:'/assets/maps/'+path.basename(l['原图文件'] || m['原图文件']),includes:l['包含区域'] || [],excludes:l['排除区域'] || [],enabled:l['启用'] !== false})),
    points:[]
  }));
  const sourcePath = path.join(data,'source.json');
  const lighthouse=maps.find(m=>m.name==='灯塔');
  if(lighthouse && fs.existsSync(path.join(root,'public/assets/maps/lighthouse-re3mr-v1.7.png'))){
    lighthouse.layers[0].name='旧图 · 已校准';
    lighthouse.layers.push({index:lighthouse.layers.length,name:'新版 v1.7 · 参考图',min:0,max:0,matrix:null,tps:null,image:'/assets/maps/lighthouse-re3mr-v1.7.png',includes:[],excludes:[],enabled:false,referenceOnly:true,
      note:'RE3MR v1.7（适用 1.1.5）：新版地形、AI 与 BTR 参考图；尚未校准，当前层不显示实时位置或任务标点。'});
  }
  return { tasks, maps, traders:[...new Set(tasks.map(q=>q.trader))].map(name=>({name,label:name==='Story'?'主线章节':traderNames[name] || name,image:name==='Story'?'/story.svg':`/assets/traders/${name}.webp`})),
    source:{...(fs.existsSync(sourcePath)?read(sourcePath):{fetchedAt:null,taskCount:tasks.length,url:'https://member.kaedeori.com',mode:'pve'}),supplements:supplemented.metadata} };
}
