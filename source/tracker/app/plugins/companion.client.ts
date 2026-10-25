import { useMetadataStore } from '@/stores/useMetadata';
import { usePreferencesStore } from '@/stores/usePreferences';
import { useTarkovStore } from '@/stores/useTarkov';
import { mergeCompanionSnapshot } from '@/utils/companionState';
import { otherRequirementsSignature } from '@/utils/taskOtherRequirements';
import type { CompanionSnapshot, CompanionUpdate } from '@/types/companion';
export default defineNuxtPlugin({
  name: 'local-companion',
  dependsOn: ['metadata'],
  async setup(nuxtApp) {
  const bridge = window.companion;
  if (!bridge) return;
  const snapshot = useState<CompanionSnapshot | null>('companion', () => null);
  const store = useTarkovStore();
  store.switchGameMode('pve');
  const metadata = useMetadataStore();
  usePreferencesStore().setLocaleOverride('zh');
  let applying = false;
  let profile = '';
  let lastUi = '';
  let appliedRevision = -1;
  let lastSaved = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshRequest: Promise<void> | null = null;
  const refresh = (): Promise<void> => {
    refreshRequest ??= bridge.getState().then((next) => { apply(next); }).catch((error) => {
      if (snapshot.value) snapshot.value.runtime.error = String(error);
    }).finally(() => { refreshRequest = null; });
    return refreshRequest;
  };
  const applyProgress = (next: CompanionSnapshot): void => {
    const ui = JSON.stringify(next.ui);
    if (next.ui.pve && (ui !== lastUi || profile !== next.profile)) {
      // This is the complete saved profile, so removed objectives must not survive a deep merge.
      store.$patch((state) => { Object.assign(state, JSON.parse(ui)); });
      lastUi = ui;
    }
    profile = next.profile;
    if (store.currentGameMode !== 'pve') store.switchGameMode('pve');
    for (const [id, entry] of Object.entries(next.progress)) {
      const old = store.pve.taskCompletions[id];
      if (!['active', 'ready', 'completed', 'failed'].includes(entry.status)) continue;
      if ((old?.timestamp ?? 0) < entry.at) {
        store.pve.taskCompletions[id] = {
          complete: ['completed', 'failed'].includes(entry.status),
          failed: entry.status === 'failed',
          manual: entry.status === 'failed',
          timestamp: entry.at,
        };
      }
      const task = metadata.tasks.find((candidate) => candidate.id === id);
      if (task && entry.status === 'active') {
        const requirements = otherRequirementsSignature(task);
        const previous = store.pve.taskAvailability?.[id];
        if (requirements && (previous?.requirements !== requirements || previous.timestamp !== entry.at)) {
          (store.pve.taskAvailability ??= {})[id] = { requirements, timestamp: entry.at };
        }
      }
    }
  };
  const apply = (update: CompanionUpdate, force = false): void => {
    const result = mergeCompanionSnapshot(snapshot.value, update);
    if (result.needsRefresh) void refresh();
    const next = result.snapshot;
    if (!next) return;
    snapshot.value = next;
    if (!force && appliedRevision === next.progressRevision && profile === next.profile) return;
    applying = true;
    try { applyProgress(next); appliedRevision = next.progressRevision; }
    finally { applying = false; }
  };
  bridge.subscribe(apply);
  await refresh();
  // Listen before the map becomes interactive; a late initial save from a second
  // window can otherwise overwrite the first window's new objective completion.
  lastSaved = JSON.stringify(store.$state);
  let lastSavedObjectives = JSON.stringify(store.pve.taskObjectives);
  const persistProgress = (): void => {
      const serialized = JSON.stringify(store.$state);
      if (serialized === lastSaved) return;
      lastSaved = serialized;
      lastSavedObjectives = JSON.stringify(store.pve.taskObjectives);
      const state = JSON.parse(serialized);
      void bridge.saveProgress({ profile, state }).catch((error) => {
        if (snapshot.value) snapshot.value.runtime.error = String(error);
      });
  };
  store.$subscribe(() => {
    if (applying || !profile) return;
    clearTimeout(timer);
    // Persist goal clicks before another window can replace the optimistic state.
    if (JSON.stringify(store.pve.taskObjectives) !== lastSavedObjectives) persistProgress();
    else timer = setTimeout(persistProgress, 350);
  }, { detached: true, flush: 'sync' });
  nuxtApp.hook('app:mounted', async () => {
    const prefs = usePreferencesStore();
    prefs.setLocaleOverride('zh');
    nuxtApp.$i18n.setLocaleMessage('zh', { ...nuxtApp.$i18n.getLocaleMessage('zh'), companion: {"map":"实时地图","tasks":"任务 / 任务树","settings":"本地设置","overlay":"置顶小地图","capture":"自动截图","follow":"跟随","fullscreen":"全屏","on":"开","off":"关","connected":"本机日志已连接","connecting":"正在连接本机日志","active_tasks":"进行中任务","position_hint":"在游戏内按 Insert 更新定位","loading_maps":"正在加载地图…","logs":"游戏 Logs 目录","screenshots":"游戏 Screenshots 目录","choose":"选择目录","seconds":"秒","cleanup":"读取坐标后删除对应游戏截图","hotkey":"小地图显示 / 隐藏快捷键","opacity":"小地图不透明度","save_all":"保存全部设置","saved":"设置已保存","controls_hint":"左键拖动平移；滚轮缩放；Ctrl + 滚轮或顶部菜单切层。自由查看地图时关闭跟随。右下角重置按钮可显示全图。","task_keys":"任务钥匙","current_point":"当前点位","expand_task":"展开完整任务（{count} 项）","collapse_task":"仅看当前点位","required_key":"必需","optional_key":"可选目标","keys_any":"任选一把即可","keys_all":"全部需要","keys_or":"或","keys_and":"和","overview":"显示全图（关闭跟随）"} });
    nuxtApp.$i18n.mergeLocaleMessage('zh', { companion: {"key_rooms":"钥匙房","point_floor":"所在楼层","floor_unknown":"楼层暂未收录","key_unknown":"钥匙名称暂未收录","item_unknown":"所需物品名称暂未收录","activation_label":"启用条件","activation_unknown":"对应撤离开关","activation_required":"需要启用开关：{name}","power_required":"需要先接通电力。","extract_faction":"可用阵营","extract_conditions":"撤离条件","extract_item_required":"需要物品：{name} × {count}","extract_conditions_unknown":"额外限制暂未收录，请核对游戏内的撤离提示。","extract_availability":"是否开放以本局撤离列表为准；地图不显示实时供电、车辆和倒计时状态。","floor_names":{"ground":"地面 / 一层","first":"一层","second":"二层","third":"三层","fourth":"四层","fifth":"五层","bunkers":"地下地堡","underground":"地下层","tunnels":"地下隧道","technical":"技术层 / 地下层","garage":"地下车库"},"extract_factions":{"pmc":"PMC","scav":"Scav","shared":"PMC / Scav","unknown":"暂未收录"},"extract_rules":{"coop":"至少一名 PMC 和一名 Scav 同时进入撤离区域，合作撤离。","vehicle":"车辆必须在场；支付游戏提示的卢布，并在车辆离开前回到撤离范围。人数有限，车辆每局只离开一次。","flare":"在对应信号区域内，按游戏提示使用指定信号弹，再沿指定通路撤离。","green_flare":"在对应信号区域内向空中发射绿色信号弹，确认后再进入狙击手控制的撤离通路。","no_backpack":"不能携带背包进入撤离区域，需要先卸下背包。","climbing":"携带红色叛逆者冰镐和登山绳，不能穿戴独立防弹衣；可穿防弹胸挂。冰镐和绳索不消耗。","train":"等待装甲列车到站，并在发车时留在列车内。列车每局只离开一次。","bunker_power":"拉下地堡密闭门供电开关，在供电有效期内抵达撤离点；供电结束后需要重新拉闸。","d2":"先在地下指挥地堡开启供电，再按 D-2 大门旁按钮，等待大门打开后进入撤离区。","factory_key":"使用工厂紧急出口钥匙打开撤离门；其他玩家已经打开门时可以直接通过。","zb013":"先在 4 号仓库开启供电，再使用工厂紧急出口钥匙打开 ZB-013 撤离门。","old_gas":"PMC 条件撤离点；先确认绿色烟雾和本局撤离列表，再进入老加油站地下室。","saferoom":"发电站供电后，在 Burger Spot 小便池后的读卡器使用 #11SR 钥匙卡，再进入地下安全屋关门撤离；每局一次。","labs_cargo":"先在地下 G1 房间恢复货运电梯供电，再呼叫电梯；撤离区在上层，单局只能使用一次。","labs_main":"先在地下 R4 对面恢复主电梯供电，再呼叫电梯。","labs_medical":"先在地下 G6 房间恢复医疗区电梯供电，再呼叫电梯。","labs_parking":"本局开放时，在上层停车场控制室启动开门，等待大门打开。","labs_hangar":"本局开放时，在上层 B24 控制室启动开门，等待库房大门打开。","labs_sewage":"启动排水开关并等待水位下降，满足条件后进入污水管道撤离区域。"}} });
    await nuxtApp.$i18n.setLocale('zh');
    nuxtApp.$i18n.mergeLocaleMessage('zh', { companion: { save_failed: '设置未保存，请重试' } });
    watch(() => metadata.tasks.length, () => {
      if (snapshot.value) apply(snapshot.value, true);
    });
  });
  },
});
