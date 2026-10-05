import { buildProjection,selectCalibratedLayer } from './coordinates.mjs';
import { taskLocationPoints } from './map-points.mjs';
import {storyStatus,renderExtraConditions,renderStoryObjectives} from './task-details.mjs';
const $=id=>document.getElementById(id);
const overlayMode=new URLSearchParams(location.search).has('overlay');
if(overlayMode)document.body.classList.add('mini','overlay');
if(overlayMode)$('mapViewport').append($('detailPanel'));
document.addEventListener('keydown',e=>{
  if(e.key==='Tab' && !$('settings').open && (overlayMode || currentView==='map' && !e.target.closest('input,textarea,select,[contenteditable=true]'))){e.preventDefault();document.activeElement?.blur();}
},true);
const escape=s=>String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={active:'进行中',completed:'已完成',unknown:'状态未知',failed:'失败',ready:'可提交'};
let catalog,state,selectedTask=null,selectedTrader='Prapor',selectedMap='中心区',floor=0,currentView='map',lastDetectedMap=null,mapGeneration=0;
let treeLayout=new Map(),selectedPosition=null,treeBuiltFor=null;
let markerLayoutPending=false;
const mapAliases={'塔科夫街区':'街区','海岸':'海岸线','任意':'任意地图'};
const mapIds={
  '56f40101d2720b2a4d8b45d6':'海关','5704e3c2d2720bac5b8b4567':'森林','55f2d3fd4bdc2d5f408b4567':'工厂','59fc81d786f774390775787e':'工厂',
  '5714dbc024597771384a510d':'立交桥','5704e554d2720bac5b8b456e':'海岸线','5704e5fad2720bcf85d8b460':'储备站','5704e4dad2720b948f968b457':'灯塔',
  '5704e4dad2720bb55b8b4567':'灯塔','5714dc692459777137212e12':'街区','5b0fc42d86f7744a585f9105':'实验室',
  '653e6760052c01c1c805532f':'中心区','65b8d6f5cdde2479cb2a3125':'中心区','68236e8153654e8c1200798a':'中心区',
  '5704e5fad2720bc05b8b4567':'储备站','65cc8f81a9aac3e77d0cfd3e':'码头','6733700029c367a3d40b02af':'迷宫','69af492a4819ea4ba10a69c5':'破冰船','6a294a5b5eb5f9a1700417b7':'实验室'
};
const projections=new Map();
function projection(map,layer) {
  const key=map.name+':'+layer.index;
  if(!projections.has(key)) {try{projections.set(key,buildProjection(layer));}catch{projections.set(key,null);}}
  return projections.get(key);
}
function task(id){return catalog.tasks.find(q=>q.id===id);}
function status(q){return storyStatus(q,state.progress);}
function levelLabel(q){return q.story?'主线章节 '+q.order:q.level>0?'Lv.'+q.level:'未列角色等级';}
function loyaltyLevel(q){return Math.max(1,...(q.traderRequirements || []).filter(r=>r.requirementType==='level' && r.trader?.id===q.traderId && ['>=','>','='].includes(r.compareMethod)).map(r=>Number(r.value)+(r.compareMethod==='>'?1:0)));}
function loyaltyLabel(q){return q.story?'流程与分支':q.reference?'攻略补充':(q.traderRequirements || []).some(r=>r.requirementType==='level' && r.trader?.id===q.traderId)?'LL'+loyaltyLevel(q):'未列 LL';}
function unlockText(q){
  const requirements=(q.traderRequirements || []).map(r=>`${catalog.traders.find(t=>catalog.tasks.some(a=>a.trader===t.name && a.traderId===r.trader?.id))?.label || '商人'} ${r.requirementType==='level'?'忠诚等级':'声望'} ${r.compareMethod} ${r.value}`);
  if(q.level>0)requirements.push(`角色等级 ≥ ${q.level}`);
  if(q.faction!=='Any')requirements.push('阵营：'+q.faction);
  if(q.waitMin || q.waitMax){const divisor=q.waitMax<3600?60:3600;requirements.push(`前置达成后等待 ${q.waitMin/divisor}${q.waitMax!==q.waitMin?'–'+q.waitMax/divisor:''} ${divisor===60?'分钟':'小时'}`);}
  if(q.story)requirements.push(q.story.activation);
  return requirements.join('；') || '当前资料未列出等级或商人条件；实际开放以游戏内为准。';
}
function objectiveText(o){return (o.description || '')+(o.count>0?' ×'+o.count:'')+(o.optional&&!/可选|optional/i.test(o.description)?'（可选）':'');}
function isActive(q){return ['active','ready'].includes(status(q));}
function trader(name){return catalog.traders.find(t=>t.name===name);}
function map(){return catalog.maps.find(m=>m.name===selectedMap);}
function mapsForTask(q) {
  const names=new Set();
  for(const m of catalog.maps)if(m.points.some(p=>p.taskId===q.id))names.add(m.name);
  if(q.mapId && mapIds[q.mapId])names.add(mapIds[q.mapId]);
  for(const o of q.objectives)for(const name of o.relatedMaps || [])if(catalog.maps.some(m=>m.name===name))names.add(name);
  for(const o of q.objectives)for(const m of o.maps || []) {const name=mapIds[m.id || m] || mapAliases[m.name] || m.name;if(name && catalog.maps.some(m=>m.name===name))names.add(name);}
  return [...names];
}
function applicable(q) {
  if(mapsForTask(q).includes(selectedMap))return true;
  return /任意/.test(q.map || '') && !mapsForTask(q).length;
}
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
async function post(endpoint,body={}) {
  const response=await fetch('/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Tarkov-Local':'1'},body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(result.error || '操作失败');return result;
}
function action(fn){return async(...args)=>{try{await fn(...args);}catch(e){toast(e.message);}};}
class CanvasView {
  constructor(viewport,stage) {
    this.viewport=viewport;this.stage=stage;this.x=0;this.y=0;this.scale=1;this.didDrag=false;
    viewport.addEventListener('contextmenu',e=>e.preventDefault());
    viewport.addEventListener('pointerdown',e=>{
      if(e.button!==0 && e.button!==2)return;
      if(e.button===0 && e.target.closest('button,a,input,select'))return;
      if(e.target.closest('.overlay-bar,.detail-panel,.overlay-tasks'))return;
      this.drag={px:e.clientX,py:e.clientY,x:this.x,y:this.y};this.didDrag=false;viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove',e=>{if(!this.drag)return;const dx=e.clientX-this.drag.px,dy=e.clientY-this.drag.py;if(Math.abs(dx)+Math.abs(dy)>4)this.didDrag=true;this.x=this.drag.x+dx;this.y=this.drag.y+dy;this.apply();});
    viewport.addEventListener('pointerup',()=>{this.drag=null;setTimeout(()=>this.didDrag=false,0);});
    viewport.addEventListener('pointercancel',()=>{this.drag=null;});
    viewport.addEventListener('wheel',e=>{if(e.target.closest('.detail-panel,.overlay-tasks'))return;e.preventDefault();const rect=viewport.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0012),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
    this.apply();
  }
  apply(){this.stage.style.transform=`translate(${this.x}px,${this.y}px) scale(${this.scale})`;this.stage.style.setProperty('--markerScale',1/this.scale);if(this.stage.id==='mapStage')scheduleMarkerLayout();}
  zoom(factor,cx=this.viewport.clientWidth/2,cy=this.viewport.clientHeight/2){const s=Math.max(.025,Math.min(5,this.scale*factor));const ratio=s/this.scale;this.x=cx-(cx-this.x)*ratio;this.y=cy-(cy-this.y)*ratio;this.scale=s;this.apply();}
  fit(width,height,padding=35){if(!width || !height || !this.viewport.clientWidth)return;this.scale=Math.max(.025,Math.min(1,(this.viewport.clientWidth-padding*2)/width,(this.viewport.clientHeight-padding*2)/height));this.x=(this.viewport.clientWidth-width*this.scale)/2;this.y=(this.viewport.clientHeight-height*this.scale)/2;this.apply();}
  center(x,y,scale=this.scale){this.scale=scale;this.x=this.viewport.clientWidth/2-x*scale;this.y=this.viewport.clientHeight/2-y*scale;this.apply();}
}
const mapCanvas=new CanvasView($('mapViewport'),$('mapStage')),treeCanvas=new CanvasView($('treeViewport'),$('treeStage'));
function setView(view) {
  currentView=view;$('mapView').hidden=view!=='map';$('treeView').hidden=view!=='tree';document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='tree'){const first=treeBuiltFor!==selectedTrader;renderTree();if(first)focusTree();}else {if($('mapImage').complete && mapCanvas.scale===1)fitMap();scheduleMarkerLayout();}
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
function renderList() {
  const search=$('taskSearch').value.trim().toLowerCase(),filter=$('taskFilter').value;
  const qs=catalog.tasks.filter(q=>{const s=status(q);return (filter==='historical'?q.disabled:!q.disabled) && (filter==='all' || filter==='historical' || filter==='completed' && s==='completed' || filter==='active' && isActive(q)) && (!$('onlyMap').checked || applicable(q)) && (!search || [q.name,q.trader,trader(q.trader)?.label,...q.objectives.map(o=>o.description)].join(' ').toLowerCase().includes(search));});
  qs.sort((a,b)=>Number(isActive(b))-Number(isActive(a)) || a.name.localeCompare(b.name,'zh'));
  $('activeCount').textContent=catalog.tasks.filter(isActive).length;
  $('taskList').innerHTML=qs.map(q=>`<button class="task-row ${status(q)} ${q.id===selectedTask?'selected':''}" data-task="${q.id}"><strong>${escape(q.name)}</strong><small>${escape(q.objectives[0]?objectiveText(q.objectives[0]):'查看任务详情')}</small><div class="row-meta"><small>${escape(trader(q.trader)?.label || q.trader)} · ${escape(q.map || '任意')}</small><small class="${status(q)}-color">${statuses[status(q)]}</small></div></button>`).join('') || '<div class="empty">当前筛选下没有任务。<br>可切换“所有任务”查找并补录。<br>日志中没有记录的状态显示为未知。</div>';
  $('taskList').querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>selectTask(b.dataset.task)));
}
for(const id of ['taskSearch','taskFilter','onlyMap'])$(id).addEventListener(id==='taskSearch'?'input':'change',renderList);
async function loadMap(fit=true) {
  const m=map();if(!m)return;
  const generation=++mapGeneration;
  floor=Math.max(0,Math.min(floor,m.layers.length-1));
  const note=m.layers[floor].note || m.note;
  $('mapHint').textContent=note || '滚轮缩放 · 拖动地图 · 点击任务点';
  $('mapHint').classList.toggle('map-note',!!note);
  $('floorSelect').innerHTML=m.layers.map(l=>`<option value="${l.index}" ${floor===l.index?'selected':''}>${escape(l.name)}${projection(m,l)?'':' · 未校准'}</option>`).join('');
  $('overlayFloor').innerHTML=$('floorSelect').innerHTML;
  $('overlayTitle').textContent=m.name;
  const image=$('mapImage'),source=m.layers[floor].image;
  if(image.getAttribute('src')!==source) {
    await new Promise(resolve=>{image.onload=resolve;image.onerror=()=>{toast('地图底图加载失败');resolve();};image.src=source;});
  }
  if(image.naturalWidth)await image.decode().catch(()=>{});
  if(generation!==mapGeneration)return;
  $('mapStage').style.width=image.naturalWidth+'px';$('mapStage').style.height=image.naturalHeight+'px';
  if(fit)fitMap();renderMarkers();renderList();updatePosition();
}
function fitMap(){mapCanvas.fit($('mapImage').naturalWidth,$('mapImage').naturalHeight);}
$('fitMap').addEventListener('click',fitMap);
$('mapZoomIn').addEventListener('click',()=>mapCanvas.zoom(1.3));$('mapZoomOut').addEventListener('click',()=>mapCanvas.zoom(1/1.3));
$('mapSelect').addEventListener('change',()=>{selectedMap=$('mapSelect').value;floor=0;$('autoMap').checked=false;selectedPosition=null;loadMap();});
$('floorSelect').addEventListener('change',()=>{floor=Number($('floorSelect').value);$('autoFloor').checked=false;loadMap(false);});
$('overlayFloor').addEventListener('change',()=>{floor=Number($('overlayFloor').value);$('autoFloor').checked=false;loadMap(false);});
$('autoMap').addEventListener('change',()=>{if($('autoMap').checked)applyDetectedMap();});
$('autoFloor').addEventListener('change',updatePosition);
function renderFollowPlayer(){
  const enabled=state.settings.followPlayer!==false;
  if(enabled && !$('followPlayer').checked)lastPositionAt=null;
  $('followPlayer').checked=enabled;
  $('overlayFollow').textContent=enabled?'跟随：开':'跟随：关';
  $('overlayFollow').setAttribute('aria-pressed',String(enabled));
}
async function setFollowPlayer(enabled){
  state.settings.followPlayer=enabled;renderFollowPlayer();
  if(enabled)lastPositionAt=null;
  updatePosition();
  try{await post('map-settings',{followPlayer:enabled});}
  catch(error){state=await fetch('/api/state').then(r=>r.json());renderFollowPlayer();throw error;}
}
$('followPlayer').addEventListener('change',action(()=>setFollowPlayer($('followPlayer').checked)));
$('overlayFollow').addEventListener('click',action(()=>setFollowPlayer(state.settings.followPlayer===false)));
document.querySelectorAll('[data-fullscreen]').forEach(button=>button.addEventListener('click',action(async()=>{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await $('mapViewport').requestFullscreen();
})));
document.addEventListener('fullscreenchange',()=>{
  document.querySelectorAll('[data-fullscreen]').forEach(button=>button.textContent=document.fullscreenElement?'退出全屏 · Esc':button.id==='fullscreenMap'?'全屏地图':'全屏');
  requestAnimationFrame(fitMap);
});
$('toggleOverlay').addEventListener('click',action(()=>post('overlay',{action:'toggle'})));
$('hideOverlay').addEventListener('click',action(()=>post('overlay',{action:'hide'})));

function automaticLayer(m,p) {
  return selectCalibratedLayer(m.layers,p,l=>projection(m,l));
}
function applyDetectedMap() {
  const detected=state.runtime.map;
  if($('autoMap').checked && detected && catalog.maps.some(m=>m.name===detected) && detected!==selectedMap) {
    selectedMap=detected;$('mapSelect').value=selectedMap;floor=0;loadMap();
  }
  lastDetectedMap=detected;
}
function apiPoints(q,m) {
  const positions=[];
  const matchesMap=ref=>{const id=ref?.id || ref;return mapIds[id]===m.name && (id!=='6a294a5b5eb5f9a1700417b7' || /^laboratory_dark/.test(state.runtime.scene || ''));};
  for(const o of q.objectives) {
    if(state.objectives[o.id])continue;
    for(const zone of o.zones || [])if(matchesMap(zone.map) && zone.position)positions.push({world:zone.position,description:o.description,objective:o.id});
    for(const loc of o.possibleLocations || [])if(matchesMap(loc.map))for(const p of loc.positions || [])positions.push({world:p,description:o.description,objective:o.id});
  }
  const unique=[...new Map(positions.map(p=>[[p.objective,p.world.x,p.world.y,p.world.z].join('|'),p])).values()];
  return unique.map((p,i)=>{
    const layer=automaticLayer(m,p.world);if(layer===null)return null;
    const project=projection(m,m.layers[layer]);if(!project)return null;
    const [x,y]=project(p.world.x,p.world.z);return {id:`api:${q.id}:${i}`,taskId:q.id,layer,x,y,world:p.world,description:p.description,objective:p.objective};
  }).filter(Boolean);
}
function visiblePoints() {
  const m=map();if(!m)return [];
  const qs=catalog.tasks.filter(q=>!['completed','failed','ready'].includes(status(q)) && ((!q.disabled && isActive(q)) || q.id===selectedTask));
  const points=[];
  for(const q of qs) {
    points.push(...apiPoints(q,m));
  }
  return points.filter(p=>p.layer===floor);
}
function renderMarkers() {
  const ps=visiblePoints();
  scheduleMarkerLayout();
  $('markerCount').textContent=`本层 ${taskLocationPoints(ps).length} 个任务地点 · ${map()?.name || ''}`;
  if(overlayMode){
    const quests=catalog.tasks.filter(q=>!q.disabled && isActive(q) && applicable(q));
    $('overlayTaskList').innerHTML=quests.map(q=>`<button data-overlay-task="${escape(q.id)}"><strong>${escape(q.name)}</strong><small>${escape(q.objectives.filter(o=>!state.objectives[o.id]).map(objectiveText).join('；'))}</small></button>`).join('') || '<p class="muted">当前地图暂无已接取任务</p>';
    $('overlayTaskList').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectTask(b.dataset.overlayTask);$('overlayTasks').open=false;}));
  }
  $('raidStatus').textContent=`${state.runtime.raid} · 日志地图：${state.runtime.map || '等待识别'}`;
}
function scheduleMarkerLayout() {
  if(markerLayoutPending)return;
  markerLayoutPending=true;
  requestAnimationFrame(()=>{markerLayoutPending=false;layoutMarkers();});
}
function layoutMarkers() {
  if(currentView!=='map')return;
  if(!catalog || !state)return;
  const groups=taskLocationPoints(visiblePoints());
  $('markers').innerHTML=groups.map((p,i)=>{
    const q=task(p.taskId),t=trader(q.trader),label=t?.label || q.trader;
    const description=label+' · '+q.name+' · '+[...new Set(p.points.map(p=>p.description || '任务位置'))].join('；');
    return `<div class="map-point ${status(q)} ${p.taskId===selectedTask?'selected':''}" style="left:${p.x}px;top:${p.y}px"><button class="marker" data-point="${i}" title="${escape(description)}" aria-label="${escape(description)}">${t?.image?`<img src="${escape(t.image)}" alt="${escape(label)}" draggable="false">`:''}<span>${escape(q.name)}</span></button></div>`;
  }).join('');
  $('markers').querySelectorAll('[data-point]').forEach(b=>b.addEventListener('click',()=>{const p=groups[Number(b.dataset.point)].representative;selectedPosition=p;selectTask(p.taskId);}));
}
function updatePosition() {
  const p=state.runtime.position,m=map();
  const valid=p && p.map===selectedMap && state.runtime.profile===state.selectedProfile && state.runtime.mode==='pve';
  $('player').hidden=!valid;
  if(!valid) {
    $('positionText').textContent='等待游戏截图定位';$('positionAge').textContent='在游戏内按 Insert，或开启自动截图';return;
  }
  const auto=automaticLayer(m,p);
  $('overlayTitle').textContent=m.name;
  if($('autoFloor').checked && auto===null){$('player').hidden=true;$('positionText').textContent='当前高度或区域缺少楼层校准';$('overlayTitle').textContent=m.name+' · 楼层未识别';return;}
  if($('autoFloor').checked && auto!==floor){floor=auto;loadMap(false);return;}
  const project=projection(m,m.layers[floor]);
  if(!project){$('player').hidden=true;$('positionText').textContent='此地图楼层缺少校准';return;}
  const [x,y]=project(p.x,p.z);
  if(!Number.isFinite(x) || !Number.isFinite(y)){ $('player').hidden=true;return;}
  const player=$('player');player.style.left=x+'px';player.style.top=y+'px';
  let yaw=0;
  if(p.yaw!==null){const r=p.yaw*Math.PI/180,tip=project(p.x+Math.sin(r),p.z+Math.cos(r));yaw=Math.atan2(tip[0]-x,-(tip[1]-y))*180/Math.PI;}
  player.style.setProperty('--yaw',yaw+'deg');
  player.classList.toggle('no-heading',p.yaw===null);
  player.title=p.yaw===null?'当前位置 · 截图未提供朝向':'当前位置 · 箭头为截图时朝向';
  $('positionText').textContent=`X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)} · 高度 ${p.y.toFixed(1)}${p.yaw===null?' · 朝向未知':' · 箭头为截图时朝向'}`;
  if($('followPlayer').checked && (lastPositionAt!==p.at || lastPositionMap!==selectedMap)){mapCanvas.center(x,y);lastPositionAt=p.at;lastPositionMap=selectedMap;}
  updateAge();
}
let lastPositionAt=null,lastPositionMap=null;
function updateAge(){const p=state?.runtime.position;if(!p || p.map!==selectedMap)return;const sec=Math.max(0,Math.floor((Date.now()-p.at)/1000));$('positionAge').textContent=`最后截图定位：${sec<60?sec+' 秒':Math.floor(sec/60)+' 分钟'}前${sec>60?' · 按 Insert 或开启自动截图刷新':''}`;}
setInterval(updateAge,1000);
function selectTask(id) {
  if(mapCanvas.didDrag || treeCanvas.didDrag)return;
  selectedTask=id;$('detailPanel').hidden=false;renderDetail();renderList();renderMarkers();updateTreeStatuses();
}
$('closeDetail').addEventListener('click',()=>{$('detailPanel').hidden=true;selectedTask=null;selectedPosition=null;renderMarkers();renderList();updateTreeStatuses();});
function renderDetail() {
  const q=task(selectedTask);if(!q)return;
  const content=$('detailContent'),same=content.dataset.task===q.id;
  const open=same?[...content.querySelectorAll('details')].map(d=>d.open):null,scroll=same?content.scrollTop:0;
  content.dataset.task=q.id;
  const progress=state.progress[q.id],maps=mapsForTask(q);
  const point=selectedPosition?.taskId===q.id?selectedPosition:null;
  const objectives=q.story?renderStoryObjectives(q,state):q.objectives.map(o=>
    '<label class="objective '+(state.objectives[o.id]?'done':'')+'"><input type="checkbox" data-objective="'+escape(o.id)+'" '+(state.objectives[o.id]?'checked':'')+'><span>'+escape(objectiveText(o))+'</span></label>'+
    (o.requiredKeys?.length?'<div class="objective-keys">钥匙：'+escape(o.requiredKeys.map(group=>(Array.isArray(group)?group:[group]).map(k=>k.name || k.id).join(' / ')).join('；'))+'</div>':'')
  ).join('');
  $('detailContent').innerHTML=
    '<div class="eyebrow">'+escape(trader(q.trader)?.label || q.trader)+' / PvE</div><h2>'+escape(q.name)+'</h2>'+
    '<div class="detail-meta">'+escape(q.map || '任意地图')+' · '+levelLabel(q)+' · '+statuses[status(q)]+'</div>'+
    '<div class="detail-buttons">'+['active','ready','completed','failed','unknown'].map(s=>'<button data-status="'+s+'" class="'+(status(q)===s?'active':'')+'">'+statuses[s]+'</button>').join('')+'</div>'+
    '<p class="muted">'+(progress?'来源：'+({log:'游戏日志',manual:'手动补录'}[progress.source] || progress.source)+' · '+new Date(progress.at).toLocaleString('zh-CN'):q.reference?'尚未手动记录此任务的状态。':q.story?'暂无章节的完整状态记录；已识别的步骤事件会单独同步。':'日志尚未记录此任务的状态，可手动补录。')+'</p>'+
    '<h3>开放条件</h3><p class="muted">'+escape(unlockText(q))+'</p>'+renderExtraConditions(q,catalog,state)+
    (q.requirements.length?'<h3>前置任务</h3>'+q.requirements.map(r=>{const p=task(r.id);return '<button class="prerequisite" data-prereq="'+escape(r.id)+'">↖ '+escape(p?.name || r.name || r.id)+' · '+(p?statuses[status(p)]:'未收录')+' <small>（'+escape((r.status || []).map(s=>({complete:'完成',completed:'完成',failed:'失败',active:'进行中',accepted:'接取'}[s] || s)).join(' / '))+'）</small></button>';}).join(''):'')+
    (q.story?'':'<h3>任务目标</h3>')+objectives+
    '<h3>相关地图</h3>'+(maps.length?'<div class="detail-buttons">'+maps.map(name=>'<button data-taskmap="'+escape(name)+'">⌖ '+escape(name)+'</button>').join('')+'</div>':'<p class="muted">当前资料没有可绘制的固定坐标。</p>')+
    (point?'<p>'+escape(point.description || '任务目标位置')+' · '+escape(map()?.layers[point.layer]?.name || '')+'</p>':'')+
    '<div class="detail-buttons"><button id="showInTree">查看任务树</button>'+(q.wiki?'<a href="'+escape(q.wiki)+'" target="_blank" rel="noopener noreferrer">查看 Wiki ↗</a>':'')+'</div>';
  $('detailContent').querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',action(()=>post('progress',{id:q.id,status:b.dataset.status}))));
  $('detailContent').querySelectorAll('[data-story-status]').forEach(b=>b.addEventListener('click',action(()=>post('progress',{id:b.dataset.storyId,status:b.dataset.storyStatus}))));
  $('detailContent').querySelectorAll('[data-objective]').forEach(b=>b.addEventListener('change',action(()=>post('objective',{id:b.dataset.objective,done:b.checked}))));
  $('detailContent').querySelectorAll('[data-prereq]').forEach(b=>b.addEventListener('click',()=>{const parent=task(b.dataset.prereq);if(!parent)return;if(currentView==='tree'){selectedTrader=parent.trader;treeBuiltFor=null;renderTree();focusTree(parent.id);}selectTask(parent.id);}));
  $('detailContent').querySelectorAll('[data-taskmap]').forEach(b=>b.addEventListener('click',()=>showTaskMap(q,b.dataset.taskmap)));
  $('showInTree').addEventListener('click',()=>{selectedTrader=q.trader;treeBuiltFor=null;setView('tree');focusTree(q.id);});
  if(open)content.querySelectorAll('details').forEach((d,i)=>{if(i<open.length)d.open=open[i];});
  content.scrollTop=scroll;
}
async function showTaskMap(q,name) {
  selectedMap=name;$('mapSelect').value=name;$('autoMap').checked=false;floor=0;setView('map');
  const first=apiPoints(q,map())[0];
  if(first){floor=first.layer;selectedPosition=first;}
  if(first)await setFollowPlayer(false);
  await loadMap();if(first)mapCanvas.center(first.x,first.y,Math.max(mapCanvas.scale,.35));
  renderDetail();
}
function renderTraders() {
  const order=['Story','Prapor','Therapist','Skier','Peacekeeper','Mechanic','Ragman','Jaeger','Fence','Lightkeeper','Ref','BTR Driver'];
  const ts=[...catalog.traders].sort((a,b)=>(order.indexOf(a.name)<0?99:order.indexOf(a.name))-(order.indexOf(b.name)<0?99:order.indexOf(b.name)));
  $('traders').innerHTML=ts.map(t=>`<button class="trader ${t.name===selectedTrader?'selected':''}" data-trader="${escape(t.name)}"><img src="${escape(t.image)}" alt="${escape(t.label)}">${escape(t.label)}</button>`).join('');
  $('traders').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.style.visibility='hidden';}));
  $('traders').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectedTrader=b.dataset.trader;treeBuiltFor=null;renderTree();focusTree();}));
}
function renderTree() {
  renderTraders();
  const qs=catalog.tasks.filter(q=>q.trader===selectedTrader && !q.disabled),t=trader(selectedTrader);
  $('treeTitle').textContent=(t?.label || selectedTrader)+' · 任务树';
  $('treeStats').textContent=`${qs.length} 个任务 · ${qs.filter(isActive).length} 进行中 · ${qs.filter(q=>status(q)==='completed').length} 已完成`;
  if(treeBuiltFor===selectedTrader){updateTreeStatuses();return;}
  treeBuiltFor=selectedTrader;
  const ids=new Set(qs.map(q=>q.id));
  const adjacency=new Map(qs.map(q=>[q.id,new Set()]));
  for(const q of qs)for(const r of q.requirements)if(ids.has(r.id) && r.id!==q.id){adjacency.get(q.id).add(r.id);adjacency.get(r.id).add(q.id);}
  const groups=[],seen=new Set();
  for(const q of qs)if(!seen.has(q.id)) {
    const group=[],pending=[q.id];
    while(pending.length){const id=pending.pop();if(seen.has(id))continue;seen.add(id);group.push(task(id));pending.push(...adjacency.get(id));}
    groups.push(group);
  }
  const orderGroup=group=>{
    if(selectedTrader==='Story'){const first=[...group].sort((a,b)=>a.order-b.order)[0];return {stage:1,first,priority:first.order};}
    const roots=group.filter(q=>!q.requirements.some(r=>group.some(p=>p.id===r.id)));
    const candidates=roots.length?roots:group;
    const priority=q=>['shooting-cans','first-in-line','burning-rubber','debut','shortage','supplier','introduction','gunsmith-part-1','make-ultra-great-again','acquaintance'].indexOf(q.normalizedName);
    const first=[...candidates].sort((a,b)=>(priority(a)<0?99:priority(a))-(priority(b)<0?99:priority(b)) || a.normalizedName.localeCompare(b.normalizedName,'en',{numeric:true}))[0];
    return {stage:Math.min(...candidates.map(loyaltyLevel)),first,priority:priority(first)<0?99:priority(first)};
  };
  const ordered=groups.map(group=>({group,...orderGroup(group)})).sort((a,b)=>a.stage-b.stage || a.priority-b.priority || a.first.level-b.first.level || a.first.normalizedName.localeCompare(b.first.normalizedName,'en',{numeric:true}));
  const targetWidth=1230,edgePaths=[],sections=[];let x=40,y=205,rowHeight=0,totalWidth=targetWidth,stage=null;
  treeLayout=new Map();
  for(const entry of ordered) {
    const {group}=entry;
    if(stage!==entry.stage){
      if(stage!==null)y+=rowHeight+70;
      stage=entry.stage;x=40;rowHeight=0;
      sections.push({y,text:selectedTrader==='Story'?'主线章节 · 点击查看中文流程与分支':`商人 LL${stage} 起 · ${stage===1?'含未列忠诚等级的任务':'按当前开放条件排列'}`});y+=52;
    }
    const graph=new dagre.graphlib.Graph();graph.setGraph({rankdir:'TB',nodesep:35,ranksep:54});graph.setDefaultEdgeLabel(()=>({}));
    const groupIds=new Set(group.map(q=>q.id));
    const natural=[...group].sort((a,b)=>a.order-b.order || a.normalizedName.localeCompare(b.normalizedName,'en',{numeric:true}));
    for(const q of natural)graph.setNode(q.id,{width:260,height:196});
    for(const q of natural)for(const r of q.requirements)if(groupIds.has(r.id) && r.id!==q.id)graph.setEdge(r.id,q.id);
    dagre.layout(graph);
    const size=graph.graph();
    if(x+size.width>targetWidth && x>40){x=40;y+=rowHeight+54;rowHeight=0;}
    for(const q of group){const n=graph.node(q.id);treeLayout.set(q.id,{...n,x:n.x+x,y:n.y+y});}
    for(const e of graph.edges()){const points=graph.edge(e).points.map(p=>({x:p.x+x,y:p.y+y}));edgePaths.push({source:e.v,target:e.w,points});}
    totalWidth=Math.max(totalWidth,x+size.width+40);rowHeight=Math.max(rowHeight,size.height);x+=size.width+35;
  }
  const size={width:totalWidth,height:y+rowHeight+60};$('treeStage').style.width=size.width+'px';$('treeStage').style.height=size.height+'px';
  const edges=$('treeEdges');edges.setAttribute('width',size.width);edges.setAttribute('height',size.height);
  edges.innerHTML='<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#88929d"/></marker></defs>'+edgePaths.map(e=>`<path data-source="${e.source}" data-target="${e.target}" marker-end="url(#arrow)" class="tree-edge ${state.progress[e.source]?.status==='completed'?'done':''}" d="M${e.points.map(p=>`${p.x},${p.y}`).join(' L')}"/>`).join('');
  $('treeNodes').innerHTML=`<div class="tree-root" style="left:${size.width/2-130}px;top:35px"><img src="${escape(t?.image || '')}" alt=""><strong>${escape(t?.label || selectedTrader)}</strong></div>`+sections.map(section=>`<div class="tree-section" style="top:${section.y}px;width:${size.width-80}px">${escape(section.text)}<small>链内由上到下；连线表示资料列出的任务前置</small></div>`).join('')+qs.map(q=>{const n=treeLayout.get(q.id);return `<button class="tree-card ${status(q)} ${q.id===selectedTask?'selected':''}" data-task="${q.id}" style="left:${n.x-130}px;top:${n.y-98}px"><div class="card-heading"><strong>${escape(q.name)}</strong><span class="badge">${statuses[status(q)]}</span></div><div class="card-body"><img class="card-bg" src="${escape(t?.image || '')}" alt=""><div class="card-meta">⌖ ${escape(q.map || '任意地图')} · ${levelLabel(q)} · ${loyaltyLabel(q)}${q.kappa?'<em>Kappa</em>':''}${q.lightkeeper?'<em>灯塔</em>':''}</div>${q.objectives.slice(0,2).map(o=>`<div class="card-goal">· ${escape(objectiveText(o))}</div>`).join('')}${q.objectives.length>2?`<div class="card-goal muted">另有 ${q.objectives.length-2} 个目标</div>`:''}<div class="card-prereq">↖ ${q.requirements.length?q.requirements.map(r=>escape(task(r.id)?.name || r.name || r.id)).join(' · '):'当前数据未列出前置'}</div></div></button>`;}).join('');
  $('treeNodes').querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>selectTask(b.dataset.task)));
  $('treeNodes').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.style.visibility='hidden'));
}
function updateTreeStatuses(){for(const edge of $('treeEdges').querySelectorAll('[data-source]'))edge.classList.toggle('done',state.progress[edge.dataset.source]?.status==='completed');for(const b of $('treeNodes').querySelectorAll('[data-task]')){const q=task(b.dataset.task);b.className=`tree-card ${status(q)} ${q.id===selectedTask?'selected':''}`;b.querySelector('.badge').textContent=statuses[status(q)];}}
function focusTree(id) {
  if(!id){
    const width=Number.parseFloat($('treeStage').style.width);
    treeCanvas.scale=Math.min(.9,($('treeViewport').clientWidth-70)/width);
    treeCanvas.x=($('treeViewport').clientWidth-width*treeCanvas.scale)/2;treeCanvas.y=12;treeCanvas.apply();return;
  }
  const qs=catalog.tasks.filter(q=>q.trader===selectedTrader);
  const target=id || [...treeLayout].sort((a,b)=>(a[1].y-a[1].height/2)-(b[1].y-b[1].height/2) || a[1].x-b[1].x)[0]?.[0];
  const n=treeLayout.get(target);if(n){treeCanvas.center(n.x,n.y,Math.min(.85,($('treeViewport').clientWidth-60)/350));if(n.y<450){treeCanvas.y=12;treeCanvas.apply();}}
}
$('focusActive').addEventListener('click',()=>{const first=catalog.tasks.filter(q=>q.trader===selectedTrader && !q.disabled && isActive(q)).sort((a,b)=>treeLayout.get(a.id).y-treeLayout.get(b.id).y)[0];if(first)focusTree(first.id);else toast('该商人暂无已识别的进行中任务');});
$('treeStart').addEventListener('click',()=>focusTree());
$('fitTree').addEventListener('click',()=>treeCanvas.fit(parseFloat($('treeStage').style.width),parseFloat($('treeStage').style.height)));
function searchTree() {
  const text=$('treeSearch').value.trim().toLowerCase();if(!text)return;
  const qs=catalog.tasks.filter(q=>!q.disabled && q.name.toLowerCase().includes(text));
  const q=qs.find(q=>q.trader===selectedTrader) || qs[0];
  if(!q){toast('未找到任务');return;}selectedTrader=q.trader;treeBuiltFor=null;renderTree();selectTask(q.id);focusTree(q.id);
}
$('findTree').addEventListener('click',searchTree);$('treeSearch').addEventListener('keydown',e=>{if(e.key==='Enter')searchTree();});
function renderAutoScreenshot() {
  const auto=state.runtime.autoScreenshot;
  const enabled=state.settings.autoScreenshotEnabled,seconds=state.settings.autoScreenshotInterval;
  for(const id of ['toggleAutoShot','overlayAutoShot']) {
    const button=$(id);
    button.textContent=`自动截图：${enabled?seconds+'秒':'关'}`;
    button.classList.toggle('auto-shot-on',enabled);
    button.setAttribute('aria-pressed',String(enabled));
    button.title=enabled?'点击停止自动发送 Insert':'点击按设定间隔自动发送 Insert';
  }
  $('autoShotHud').textContent=`Insert · ${auto?.message || '自动截图已关闭'}${enabled?' · 每 '+seconds+' 秒':''}`;
  $('autoShotStatus').textContent=(auto?.message || '自动截图已关闭')+(auto?.error?'：'+auto.error:'')+(auto?.lastPressAt?'；最近按键：'+new Date(auto.lastPressAt).toLocaleTimeString('zh-CN'):'')+(state.runtime.position?'；最近定位截图：'+new Date(state.runtime.position.at).toLocaleTimeString('zh-CN'):'');
}
function renderOverlay() {
  $('overlayOpacityQuick').value=state.settings.overlayOpacity ?? 100;$('overlayOpacityQuickValue').textContent=$('overlayOpacityQuick').value+'%';
  const overlay=state.runtime.overlay,hotkey=state.settings.overlayHotkey || 'F8';
  $('toggleOverlay').textContent=`${overlay?.visible?'隐藏':'置顶'}浮窗${state.settings.overlayHotkeyEnabled?' · '+hotkey.replace('Control','Ctrl'):''}`;
  $('toggleOverlay').title=state.settings.overlayHotkeyEnabled?`全局快捷键 ${hotkey}`:'点击打开独立置顶地图';
  $('overlayStatus').textContent=overlay?.error?'浮窗提示：'+overlay.error:overlay?.ready?`桌面组件已连接 · ${overlay.visible?'浮窗已显示':'浮窗已隐藏'} · ${overlay.shortcutRegistered?'全局快捷键 '+hotkey+' 已注册':'全局快捷键已关闭'}`:'正在连接桌面浮窗组件';
}
for(const id of ['toggleAutoShot','overlayAutoShot'])$(id).addEventListener('click',action(async()=>{
  const buttons=['toggleAutoShot','overlayAutoShot'].map($);
  for(const button of buttons)button.disabled=true;
  try{await post('auto-screenshot',{enabled:!state.settings.autoScreenshotEnabled,intervalSeconds:state.settings.autoScreenshotInterval});toast('自动截图设置已保存');}
  finally{for(const button of buttons)button.disabled=false;}
}));
function showSettings() {
  $('overlayHotkeyEnabled').checked=state.settings.overlayHotkeyEnabled;
  $('overlayHotkey').value=state.settings.overlayHotkey || 'F8';renderOverlay();
  $('overlayOpacity').value=state.settings.overlayOpacity ?? 100;$('overlayOpacityValue').textContent=$('overlayOpacity').value+'%';
  $('autoShotEnabled').checked=state.settings.autoScreenshotEnabled;
  $('autoShotInterval').value=state.settings.autoScreenshotInterval;
  $('cleanupScreenshots').checked=state.settings.screenshotCleanupEnabled;
  renderAutoScreenshot();
  $('logsPath').value=state.settings.logsPath;$('screenshotsPath').value=state.settings.screenshotsPath;
  $('profileSelect').innerHTML=state.profiles.map(p=>`<option value="${escape(p.id)}" ${p.id===state.selectedProfile?'selected':''}>${escape(p.label)}</option>`).join('') || '<option value="">等待日志识别 PvE 角色</option>';
  $('diagnostics').innerHTML=`日志：${escape(state.runtime.logStatus)}<br>监听文件：${state.runtime.logFiles} · 当前模式：${escape(state.runtime.mode || '未知')}<br>游戏版本：${escape(state.runtime.gameVersion || '等待日志')}<br>截图：${escape(state.runtime.screenshotStatus || '等待连接')}<br>当前场景：${escape(state.runtime.scene || '等待地图日志')}<br>未收录任务事件：${state.runtime.unknownTasks}<br>最近事件：${escape(state.runtime.events[0]?.text || '暂无')}`;
  $('sourceText').textContent=`当前展示 ${catalog.tasks.filter(q=>!q.disabled).length} 项：${catalog.tasks.filter(q=>q.kind==='trader'&&!q.disabled).length} 个商人任务、${catalog.tasks.filter(q=>q.story).length} 个主线章节、${catalog.tasks.filter(q=>q.reference&&!q.disabled).length} 个攻略补充任务；另保留 ${catalog.tasks.filter(q=>q.disabled).length} 项历史记录。资料获取于 ${new Date(catalog.source.supplements?.fetchedAt || catalog.source.fetchedAt).toLocaleString('zh-CN')}。任务来源：枫织梦境、tarkov.dev PvE、TarkovTracker 社区修正及 Wiki；攻略补充任务暂需手动跟踪。底图、头像和校准来自妙妙工具箱3.08.3，未使用其 SPT 任务或进度。`;
  $('settings').showModal();
}
$('settingsButton').addEventListener('click',showSettings);$('closeSettings').addEventListener('click',()=>$('settings').close());
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
  const button=$('saveSettings');button.disabled=true;
  try{await post('settings',{logsPath:$('logsPath').value,screenshotsPath:$('screenshotsPath').value,profileId:$('profileSelect').value,
    autoScreenshotEnabled:$('autoShotEnabled').checked,autoScreenshotInterval:Number($('autoShotInterval').value),screenshotCleanupEnabled:$('cleanupScreenshots').checked,
    overlayHotkeyEnabled:$('overlayHotkeyEnabled').checked,overlayHotkey:$('overlayHotkey').value,overlayOpacity:Number($('overlayOpacity').value)});
    toast('全部设置已保存');$('settings').close();
  }finally{button.disabled=false;}
})()});
for(const button of document.querySelectorAll('[data-directory]'))button.addEventListener('click',action(async()=>{
  button.disabled=true;
  try{const result=await post('choose-directory',{kind:button.dataset.directory});if(!result.canceled && result.path)$(button.dataset.directory).value=result.path;}
  finally{button.disabled=false;}
}));
$('overlayOpacity').addEventListener('input',()=>$('overlayOpacityValue').textContent=$('overlayOpacity').value+'%');
$('overlayOpacityQuick').addEventListener('input',()=>$('overlayOpacityQuickValue').textContent=$('overlayOpacityQuick').value+'%');
$('overlayOpacityQuick').addEventListener('change',action(async()=>{
  try{await post('overlay-opacity',{opacity:Number($('overlayOpacityQuick').value)});}
  finally{state=await fetch('/api/state').then(r=>r.json());renderOverlay();}
}));
$('replayLogs').addEventListener('click',action(async()=>{await post('replay');toast('历史日志已重新读取');showSettingsRefresh();}));
function showSettingsRefresh(){if($('settings').open){$('settings').close();showSettings();}}
$('undoProgress').addEventListener('click',action(async()=>{await post('undo');toast('已撤销上次手动任务状态');}));
function onState(next) {
  const previous=state?.runtime.position?.at;state=next;
  if(!catalog)return;
  renderFollowPlayer();
  if(lastDetectedMap!==state.runtime.map)applyDetectedMap();
  renderList();renderMarkers();renderAutoScreenshot();renderOverlay();
  if(previous!==state.runtime.position?.at || currentView==='map')updatePosition();
  if(selectedTask && !$('detailPanel').hidden)renderDetail();
  if(currentView==='tree')renderTree();
}
try {
  [catalog,state]=await Promise.all([fetch('/api/catalog').then(r=>r.json()),fetch('/api/state').then(r=>r.json())]);
  for(const q of catalog.tasks)if(q.mapId && catalog.maps.some(m=>m.name===(mapAliases[q.map] || q.map)))mapIds[q.mapId]=mapAliases[q.map] || q.map;
  selectedMap=catalog.maps.some(m=>m.name===state.runtime.map)?state.runtime.map:'中心区';
  $('mapSelect').innerHTML=catalog.maps.map(m=>`<option value="${escape(m.name)}" ${m.name===selectedMap?'selected':''}>${escape(m.name)}</option>`).join('');
  renderFollowPlayer();
  await loadMap();renderList();renderTraders();renderAutoScreenshot();renderOverlay();lastDetectedMap=state.runtime.map;
  const events=new EventSource('/api/events');
  events.onopen=()=>{$('connectionDot').classList.add('connected');$('connectionText').textContent='本地已连接 · 官方 PvE';};
  events.onmessage=e=>onState(JSON.parse(e.data));
  events.onerror=()=>{$('connectionDot').classList.remove('connected');$('connectionText').textContent='连接中断 · 正在重连';};
  if(new URLSearchParams(location.search).has('mini'))document.body.classList.add('mini');
  window.addEventListener('resize',()=>{if(currentView==='map')fitMap();else focusTree(selectedTask || null);});
}catch(e){toast('无法连接本地助手：'+e.message);$('connectionText').textContent='启动失败';}
