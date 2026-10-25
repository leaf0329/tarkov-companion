<template>
  <div class="bg-surface-950 flex h-screen flex-col font-sans">
    <CompanionToolbar />
    <div class="flex min-h-0 flex-1">
      <aside v-if="!overlay && !isPvp" class="border-surface-700 w-72 shrink-0 overflow-y-auto border-r p-3">
        <h2 class="mb-3 font-semibold">{{ t('companion.active_tasks') }} · {{ activeTasks.length }}</h2>
        <NuxtLink v-for="task in activeTasks" :key="task.id" :to="'/tasks?q=' + encodeURIComponent(task.name || '')" class="bg-surface-800 hover:bg-surface-700 mb-2 block rounded-lg p-3">
          <div class="flex items-center gap-2"><img v-if="task.trader?.imageLink" :src="task.trader.imageLink" class="h-8 w-8 rounded-full" alt=""><strong class="text-sm">{{ task.name }}</strong></div>
          <p class="text-surface-400 mt-2 text-xs">{{ task.trader?.name }} · {{ task.map?.name }}</p>
        </NuxtLink>
      </aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="border-surface-700 flex items-center gap-3 border-b p-2">
          <SelectMenuFixed v-model="displayedMap" v-model:open="mapMenuOpen" :items="mapOptions" data-testid="companion-map-select" :data-value="displayedMap" :aria-label="t('companion.map')" class="max-w-48 [-webkit-app-region:no-drag]" :ui="{ base: 'h-8 px-2 py-1 text-sm' }" />
          <label v-if="floors.length > 1" class="flex items-center gap-2 text-xs">
            {{ t('maps.floors') }}
            <SelectMenuFixed v-model="selectedFloor" v-model:open="floorMenuOpen" :items="floorOptions" data-testid="companion-floor-select" :data-value="selectedFloor" :aria-label="t('maps.floors')" class="max-w-48 [-webkit-app-region:no-drag]" :ui="{ base: 'h-8 px-2 py-1 text-sm' }" @update:model-value="mapRef?.setFloor($event as string)" />
          </label>
          <AppTooltip :text="t('companion.controls_hint')"><span class="text-surface-400 cursor-help px-1 text-xs" tabindex="-1">?</span></AppTooltip>
          <span v-if="!overlay" class="text-surface-400 text-xs">{{ state?.runtime.capture?.message || t('companion.position_hint') }}</span>
        </div>
        <LeafletMap v-if="mapData" ref="mapRef" :map="mapData" :marks="mapObjectiveMarks" :fill="true" :show-floor-controls="false" :show-controls-help="false" :show-legend="!overlay" class="min-h-0 flex-1" @floor-change="selectedFloor = $event" />
        <div v-else class="text-surface-400 p-8">{{ t('companion.loading_maps') }}</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { useCompanionWindowReset } from '@/composables/useCompanionWindowReset';
  import { useMapObjectiveMarks } from '@/composables/useMapObjectiveMarks';
  import LeafletMap from '@/features/maps/LeafletMap.vue';
  import { useMetadataStore } from '@/stores/useMetadata';
  import { useTarkovStore } from '@/stores/useTarkov';
  import { isTaskActive } from '@/utils/taskStatus';
  import type { CompanionSnapshot } from '@/types/companion';
  definePageMeta({ layout: false });
  const { t } = useI18n();
  const route = useRoute();
  const overlay = computed(() => route.query.overlay === '1');
  const state = useState<CompanionSnapshot | null>('companion');
  const isPvp = computed(() => ['pvp', 'pvp-season'].includes(state.value?.runtime.mode ?? ''));
  const metadata = useMetadataStore();
  const store = useTarkovStore();
  const selectedMap = ref('56f40101d2720b2a4d8b45d6');
  const mapRef = ref<InstanceType<typeof LeafletMap> | null>(null);
  const selectedFloor = ref('');
  const mapMenuOpen = ref(false);
  const floorMenuOpen = ref(false);
  useCompanionWindowReset(() => { mapMenuOpen.value = false; floorMenuOpen.value = false; });
  const mapData = computed(() => metadata.mapsWithSvg.find((map) => map.id === selectedMap.value || map.mergedIds?.includes(selectedMap.value)));
  const displayedMap = computed({ get: () => mapData.value?.id ?? selectedMap.value, set: (value: string) => { selectedMap.value = value; } });
  const mapOptions = computed(() => metadata.mapsWithSvg.map((map) => ({ value: map.id, label: map.name ?? map.id })));
  const floors = computed(() => {
    const config = mapData.value?.svg;
    return typeof config === 'object' ? config.floors : (mapData.value?.tile?.floors ?? []);
  });
  const floorOptions = computed(() => floors.value.map((floor) => ({ value: floor, label: floor.replace(/_/g, ' ') })));
  const activeTasks = computed(() => isPvp.value ? [] : metadata.tasks.filter((task) => isTaskActive(store.pve.taskCompletions[task.id])));
  const { mapObjectiveMarks } = useMapObjectiveMarks({ mapId: computed(() => mapData.value?.id ?? selectedMap.value), tasks: activeTasks, shouldShowCompletedObjectives: computed(() => false) });
  watch(() => state.value?.runtime.map, (map) => { if (map) selectedMap.value = map; }, { immediate: true });
  onMounted(async () => { await metadata.initialize({ gameMode: 'pve' }); await metadata.fetchTaskObjectivesData(); });
</script>
