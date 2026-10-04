const escape=s=>String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ref=v=>typeof v==='string'?v:v?.id;
const statusNames={complete:'完成',completed:'完成',failed:'失败',active:'进行中',accepted:'接取',ready:'可提交',unknown:'状态未知'};
export function storyStatus(q,progress) {
  if(progress[q.id])return progress[q.id].status;
  if(q.story?.groups.some(id=>['active','ready'].includes(progress[id]?.status)))return 'active';
  return 'unknown';
}
export function conditionText(r,lookup) {
  if(r.type==='taskStatus')return `当“${lookup(ref(r.task))?.name || r.task?.name || ref(r.task)}”${(r.status || []).map(s=>statusNames[s] || s).join(' / ')}时，本任务失败`;
  if(r.description && !/^[a-f\d]{24}$/i.test(r.description))return r.description;
  return `游戏内${{extract:'撤离',useItem:'使用物品',visit:'区域',shoot:'击杀'}[r.type] || r.type}失败条件${r.count?' · '+r.count+' 次':''}`;
}
export function renderExtraConditions(q,catalog,state) {
  const lookup=id=>catalog.tasks.find(t=>t.id===id);
  let html=q.disabled?'<p class="condition-warning">历史 / 已停用任务，当前任务树默认隐藏；已保存的进度仍保留。</p>':'';
  if(q.reference)html+='<p class="condition-warning">攻略补充 · 真实日志 ID 尚未收录，请手动记录进度；名称为中文译名。位置文字已补充，精确坐标尚待验证。</p>'+(q.reference.note?'<p class="muted">'+escape(q.reference.note)+'</p>':'');
  if(q.reference?.guide?.length)html+='<h3>路线与准备</h3><ul>'+q.reference.guide.map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul><p class="muted">依据任务 Wiki 整理，核对日期：'+escape(q.reference.reviewedAt)+'。以游戏内任务提示为准。</p>';
  if(q.otherRequirements?.length)html+='<div class="extra-conditions">'+q.otherRequirements.map(r=>{
    if(r.type==='storyObjective'){
      const chapter=catalog.tasks.find(t=>t.story?.id===ref(r.storyChapter));
      const objective=chapter?.objectives.find(o=>o.id===ref(r.objective));
      const done=state.objectives[ref(r.objective)] || state.progress[objective?.sourceQuestId]?.status==='completed';
      return `<button class="prerequisite" data-prereq="${escape(chapter?.id || '')}">主线：${escape(chapter?.name || r.storyChapter?.name)} → ${escape(objective?.description || r.objective?.name)}${done?' ✓':''}</button>`;
    }
    const pool=r.counter?.derivation?.taskIds || [],known=pool.filter(id=>state.progress[id]?.status==='completed').length;
    const verified=r.counter?.verification==='verified' && r.counter?.coverage==='complete';
    return `<details class="condition-group"><summary>任务组进度 ${escape(r.compareMethod)} ${escape(r.value)}${verified?' · 本地已记录 '+known:' · 计算规则待确认'}</summary><p class="muted">${verified?'日志可能缺少历史完成记录；这里显示已知进度。':'这个条件不能只靠候选任务数量判断；以游戏内开放状态为准。'}</p>${pool.map(id=>`<button class="prerequisite" data-prereq="${escape(id)}">${escape(lookup(id)?.name || id)}${state.progress[id]?.status==='completed'?' ✓':''}</button>`).join('')}${!pool.length?`<p class="muted">条件编号：${escape(r.variableId || r.id)}</p>`:''}</details>`;
  }).join('')+'</div>';
  if(q.taskRequirementGroups?.length)html+='<h3>可选前置组合</h3>'+q.taskRequirementGroups.map((group,i)=>`<p class="muted">组合 ${i+1}：${group.map(r=>escape(lookup(ref(r.task))?.name || r.task?.name || ref(r.task))).join(' + ')}</p>`).join('');
  if(q.failConditions?.length)html+='<h3>失败与互斥条件</h3><ul class="failure-conditions">'+q.failConditions.map(r=>`<li>${escape(conditionText(r,lookup))}</li>`).join('')+'</ul>'+(q.restartable?'<p class="muted">该任务允许重新开始。</p>':'');
  return html;
}
export function renderStoryObjectives(q,state) {
  const story=q.story;
  let context=null;
  const guide=story.guide.map((s,i)=>{
    const heading=s.context!==context && s.context?`<h4 class="story-branch">${escape(s.context)}</h4>`:'';context=s.context;
    const id=s.objectiveId || s.id,done=!!state.objectives[id] || !!s.sourceQuestId && state.progress[s.sourceQuestId]?.status==='completed';
    return heading+`<label class="objective guide-step ${done?'done':''}" title="${escape(s.original)}"><input type="checkbox" data-objective="${escape(id)}" ${done?'checked':''}${s.sourceQuestId && state.progress[s.sourceQuestId]?.status==='completed'?' disabled':''}><span><small>${i+1}.</small> ${escape(s.description)}</span></label>`;
  }).join('');
  const groups=story.groups.map((id,i)=>{
    const goals=q.objectives.filter(o=>o.sourceQuestId===id),progress=state.progress[id],completed=progress?.status==='completed';
    return `<details class="story-step" ${progress?.status==='active'?'open':''}><summary>${i+1}. ${escape(goals[0]?.description)} <small>${statusNames[progress?.status] || '状态未知'}</small></summary><div class="detail-buttons">${['active','completed','failed','unknown'].map(s=>`<button data-story-status="${s}" data-story-id="${id}">${statusNames[s]}</button>`).join('')}</div>${goals.map(o=>`<label class="objective ${completed || state.objectives[o.id]?'done':''}"><input type="checkbox" data-objective="${o.id}" ${completed || state.objectives[o.id]?'checked':''} ${completed?'disabled':''}><span>${escape(o.description)}${o.optional?'（可选 / 分支目标）':''}</span></label>`).join('')}</details>`;
  }).join('');
  const pairs=story.mutuallyExclusiveQuestPairs || [];
  const groupLabel=id=>q.objectives.find(o=>o.sourceQuestId===id)?.description || id;
  return `<div class="story-guide"><h3>流程与分支</h3><p class="muted">按攻略顺序查看；带分支条件的步骤只适用于相应选择。勾选是本地记录，不会将整个章节自动判为完成。</p>${guide}</div><details class="story-game-objectives"><summary>游戏目标与步骤状态 · ${q.objectives.length} 个目标</summary><p class="muted">${story.partial?'真实 ID 资料仅覆盖部分分支，缺少的路线已在上方攻略中补充。':'已接入此章节当前资料中的全部步骤。'}日志出现步骤事件时自动同步；也可手动补录。</p>${groups}${pairs.length?'<h4>互斥路线（不能同时完成）</h4>'+pairs.map(pair=>`<p class="muted">${escape(groupLabel(pair[0]))} ↔ ${escape(groupLabel(pair[1]))}</p>`).join(''):''}</details>`;
}
