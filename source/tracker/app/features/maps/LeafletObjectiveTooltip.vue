<template>
  <div :class="fullTask ? 'w-80 max-w-[calc(100vw-4rem)]' : isCompact ? 'min-w-40' : 'min-w-55'">
    <div data-testid="objective-popup-header" class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <component
          :is="taskTitleComponent"
          v-bind="taskTitleProps"
          :class="taskTitleClass"
          @click.stop
        >
          <span class="truncate">{{ taskName }}</span>
          <UIcon
            v-if="taskWikiUrl"
            name="i-mdi-open-in-new"
            class="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        </component>
        <a
          v-if="taskTarkovDevUrl"
          :href="taskTarkovDevUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="linkButtonClass"
          :title="translate('common.view_on_tarkov_dev')"
          :aria-label="translate('common.view_on_tarkov_dev')"
          @click.stop
        >
          <img
            src="/img/logos/tarkovdevlogo.webp"
            alt="tarkov.dev"
            aria-hidden="true"
            class="h-4 w-4"
          />
        </a>
      </div>
      <div class="flex shrink-0 gap-1">
        <button
          v-if="!fullTask"
          type="button"
          :class="isCompact ? compactButtonClass : defaultButtonClass"
          :aria-label="translate('maps.tooltip.go_to_in_task_list')"
          :title="translate('maps.tooltip.go_to')"
          @click.stop="scrollToObjective"
        >
          <UIcon
            name="i-mdi-arrow-down-circle-outline"
            :class="isCompact ? 'h-3 w-3' : 'h-4 w-4'"
          />
        </button>
        <button
          v-if="!readOnly && !fullTask"
          type="button"
          :class="[
            isCompact ? compactButtonClass : defaultButtonClass,
            isToggleDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10',
          ]"
          :aria-label="
            isComplete ? translate('maps.tooltip.uncomplete') : translate('maps.tooltip.complete')
          "
          :aria-pressed="isComplete"
          :disabled="isToggleDisabled"
          @click.stop="toggleObjective"
        >
          <UIcon
            :name="isComplete ? 'i-mdi-check-circle' : 'i-mdi-circle-outline'"
            :class="isCompact ? 'h-3 w-3' : 'h-4 w-4'"
          />
        </button>
        <LeafletObjectiveTaskActions
          :task-id="taskId"
          :actions="taskVisibilityActions"
          :compact="isCompact"
          :translate="translate"
          @close="emitClose"
        />
        <button
          type="button"
          data-testid="objective-close-button"
          class="inline-flex items-center justify-center rounded-md text-gray-300 hover:bg-white/10"
          :class="isCompact ? 'h-5 w-5' : 'h-7 w-7'"
          :aria-label="translate('common.close')"
          @click.stop="emitClose"
        >
          <UIcon name="i-mdi-close" :class="isCompact ? 'h-3 w-3' : 'h-4 w-4'" />
        </button>
      </div>
    </div>
    <div data-testid="objective-popup-body" :class="[isCompact ? 'mt-0.5' : 'mt-1', fullTask ? 'overflow-y-auto pr-1' : '']" :style="fullTask ? { maxHeight: bodyMaxHeight + 'px' } : undefined">
      <div v-if="!objective" class="text-xs text-gray-400">
        {{ translate('maps.tooltip.objective_unavailable') }}
      </div>
      <div v-else :class="isCompact ? 'text-xs text-gray-200' : 'text-sm text-gray-200'">
        <ol v-if="fullTask" :data-testid="showAllObjectives ? 'task-all-objectives' : 'task-point-objectives'" class="divide-y divide-white/10">
          <li v-for="row in visibleObjectiveRows" :key="row.objective.id" data-testid="task-objective-row" :data-objective-id="row.objective.id" :data-current-objective="row.objective.id === objectiveId" class="flex items-start gap-2 py-2">
            <button v-if="!readOnly" type="button" data-testid="task-objective-toggle" class="mt-0.5 shrink-0 rounded p-0.5 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" :aria-label="(row.complete ? translate('maps.tooltip.uncomplete') : translate('maps.tooltip.complete')) + ': ' + row.objective.description" :aria-pressed="row.complete" :disabled="isToggleDisabled" @click.stop="toggleTaskObjective(row.objective)">
              <UIcon :name="row.complete ? 'i-mdi-check-circle' : 'i-mdi-circle-outline'" class="h-4 w-4" :class="{ 'text-green-300': row.complete }" />
            </button>
            <div class="min-w-0 flex-1">
              <div v-if="row.objective.id === objectiveId" data-testid="current-point-label" class="mb-1 text-[11px] font-semibold text-primary-300">{{ translate('companion.current_point') }}</div>
              <div class="text-xs leading-5" :class="row.complete ? 'text-gray-400' : 'text-gray-200'">{{ row.number }}. {{ row.objective.description }} <span v-if="row.objective.optional" class="text-amber-300">({{ translate('common.optional') }})</span></div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                <span data-testid="task-objective-count">{{ row.currentCount }}/{{ row.requiredCount }}</span>
                <span v-if="row.mapNames.length">{{ row.mapNames.join(' · ') }}</span>
              </div>
              <div v-if="row.equipment.length" class="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                <a v-for="item in row.equipment" :key="item.id" :href="toWikiUrl(getKeyPrimaryUrl(item))" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[11px] text-sky-100! no-underline hover:text-sky-200!" @click.stop>
                  <img :src="getKeyIconSrc(item)" alt="" loading="lazy" class="h-4 w-4 shrink-0 object-contain" @error="($event.target as HTMLImageElement).style.display = 'none'">
                  {{ item.name || item.shortName || item.id }}
                </a>
              </div>
            </div>
          </li>
        </ol>
        <template v-else>
          <div class="text-gray-300">{{ objective.description }}</div>
          <div v-if="!readOnly && requiredCount > 1" class="mt-1 text-[11px] text-gray-400">
            {{ currentCount }}/{{ requiredCount }}
          </div>
        </template>
        <button
          v-if="fullTask && objectiveRows.length > 1"
          type="button"
          data-testid="task-objectives-expand"
          class="mt-1 flex w-full items-center justify-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-primary-200 hover:bg-white/10"
          :aria-expanded="showAllObjectives"
          @click.stop="showAllObjectives = !showAllObjectives"
        >
          <UIcon :name="showAllObjectives ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'" class="h-4 w-4" />
          {{ translate(showAllObjectives ? 'companion.collapse_task' : 'companion.expand_task', { count: objectiveRows.length }) }}
        </button>
        <section
          v-if="requiredKeyGroups.length"
          data-testid="objective-required-keys"
          class="mt-2 border-t border-white/10 pt-2"
        >
          <div class="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-300">
            <UIcon name="i-mdi-key-variant" class="h-3.5 w-3.5" aria-hidden="true" />
            {{ translate('companion.task_keys') }}
          </div>
          <ul class="space-y-1.5">
            <li
              v-for="(group, groupIndex) in requiredKeyGroups"
              :key="groupIndex"
              data-testid="objective-key-group"
              :data-optional="group.optional === true"
              class="rounded bg-white/5 px-2 py-1.5"
            >
              <div class="mb-1 flex items-center gap-2 text-[11px]">
                <span :class="group.optional ? 'text-gray-400' : 'text-amber-300'">
                  {{
                    translate(group.optional ? 'companion.optional_key' : 'companion.required_key')
                  }}
                </span>
                <span v-if="group.keys.length > 1" class="text-gray-400">
                  {{ translate(group.anyOf ? 'companion.keys_any' : 'companion.keys_all') }}
                </span>
                <span v-if="fullTask && group.maps?.length" class="text-gray-400">{{ getMapNames(group.maps).join(' · ') }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <template v-for="(key, keyIndex) in group.keys" :key="key.id">
                  <span v-if="keyIndex > 0" class="text-[11px] text-gray-400">
                    {{ translate(group.anyOf ? 'companion.keys_or' : 'companion.keys_and') }}
                  </span>
                  <!-- Leaflet's unlayered anchor color overrides normal utility classes. -->
                  <a
                    :href="toWikiUrl(getKeyPrimaryUrl(key))"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs text-amber-100! no-underline hover:text-amber-200!"
                    @click.stop
                  >
                    <img
                      :src="getKeyIconSrc(key)"
                      alt=""
                      loading="lazy"
                      class="h-5 w-5 shrink-0 object-contain"
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
                    />
                    {{ key.name || key.shortName || key.id }}
                  </a>
                </template>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { useI18n, type Composer } from 'vue-i18n';
  import { useWikiLink } from '@/composables/useWikiLink';
  import LeafletObjectiveTaskActions from '@/features/maps/LeafletObjectiveTaskActions.vue';
  import { getObjectiveEquipmentItems } from '@/features/tasks/task-objective-equipment';
  import { useMetadataStore } from '@/stores/useMetadata';
  import { usePreferencesStore } from '@/stores/usePreferences';
  import { useTarkovStore } from '@/stores/useTarkov';
  import { logger } from '@/utils/logger';
  import { getKeyIconSrc, getKeyPrimaryUrl } from '@/utils/tarkovKeyHelpers';
  import { buildRequiredKeysFromObjectives } from '@/utils/taskRequiredKeys';
  import type { MapTaskVisibilityActions } from '@/features/maps/utils/mapTaskVisibility';
  import type { RequiredKeyGroup, TaskObjective } from '@/types/tarkov';
  import type { Router } from 'vue-router';
  const props = withDefaults(
    defineProps<{
      objectiveId: string;
      mapIds?: string[];
      readOnly?: boolean;
      fullTask?: boolean;
      viewportHeight?: Readonly<Ref<number>>;
      t?: Composer['t'];
      taskVisibilityActions?: MapTaskVisibilityActions | null;
    }>(),
    {
      readOnly: false,
      fullTask: false,
      viewportHeight: undefined,
      mapIds: undefined,
      t: undefined,
      taskVisibilityActions: null,
    }
  );
  const emit = defineEmits<{
    (e: 'close'): void;
  }>();
  function getI18nT(): Composer['t'] | undefined {
    try {
      return useI18n({ useScope: 'global' }).t;
    } catch {
      return undefined;
    }
  }
  const i18nT = getI18nT();
  const emitClose = () => {
    emit('close');
  };
  const translate: Composer['t'] = ((...args: Parameters<Composer['t']>) => {
    if (props.t) {
      return props.t(...args);
    }
    if (i18nT) {
      return i18nT(...args);
    }
    const [key] = args;
    if (typeof key === 'string') {
      return key;
    }
    logger.warn('LeafletObjectiveTooltip: invalid translation key', { key });
    return '';
  }) as Composer['t'];
  const router = inject<Router>('router');
  const metadataStore = useMetadataStore();
  const tarkovStore = useTarkovStore();
  const preferencesStore = usePreferencesStore();
  const { toWikiUrl } = useWikiLink();
  const isCompact = computed(() => preferencesStore.getMapTooltipDensity === 'compact');
  const bodyMaxHeight = computed(() => Math.min(448, Math.max(48, (props.viewportHeight?.value ?? 400) - 100)));
  const defaultButtonClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-gray-200';
  const compactButtonClass =
    'inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-200';
  const objective = computed(() => {
    return metadataStore.objectives.find((o) => o.id === props.objectiveId);
  });
  const task = computed(() => {
    const taskId = objective.value?.taskId;
    if (!taskId) return null;
    return metadataStore.tasks.find((t) => t.id === taskId) ?? null;
  });
  const taskId = computed(() => task.value?.id);
  const taskObjectives = computed(() =>
    task.value?.objectives?.length
      ? task.value.objectives
      : objective.value
        ? [objective.value]
        : []
  );
  const showAllObjectives = ref(false);
  watch(() => props.objectiveId, () => { showAllObjectives.value = false; });
  const objectiveRows = computed(() => taskObjectives.value.map((goal, index) => {
    const complete = tarkovStore.isTaskObjectiveComplete(goal.id);
    const requiredCount = goal.count ?? 1;
    return {
      objective: goal, number: index + 1, complete, requiredCount,
      currentCount: complete ? requiredCount : tarkovStore.getObjectiveCount(goal.id),
      equipment: getObjectiveEquipmentItems(goal),
      mapNames: getMapNames(goal.maps),
    };
  }));
  const visibleObjectiveRows = computed(() => showAllObjectives.value
    ? objectiveRows.value
    : objectiveRows.value.filter((row) => row.objective.id === props.objectiveId)
  );
  function getMapNames(maps: { id: string; name?: string }[] = []): string[] {
    return [...new Set(maps.map((map) => map.name ?? metadataStore.maps?.find((candidate) => candidate.id === map.id)?.name).filter((name): name is string => Boolean(name)))];
  }
  const taskKeyGroups = computed(() => {
    const groups = buildRequiredKeysFromObjectives(taskObjectives.value);
    if (!groups.length) return task.value?.requiredKeys ?? [];
    return props.fullTask
      ? buildRequiredKeysFromObjectives(visibleObjectiveRows.value.map((row) => row.objective))
      : groups;
  });
  const isCurrentMapGroup = (group: RequiredKeyGroup): boolean =>
    !props.mapIds?.length ||
    !group.maps?.length ||
    group.maps.some((map) => props.mapIds?.includes(map.id));
  const requiredKeyGroups = computed(() =>
    taskKeyGroups.value.filter((group) => group.keys.length > 0 && (props.fullTask || isCurrentMapGroup(group)))
  );
  const taskName = computed(() => task.value?.name ?? translate('common.task'));
  const taskTarkovDevUrl = computed(() => {
    if (!task.value?.id) return '';
    return `https://tarkov.dev/task/${task.value.id}`;
  });
  const taskWikiUrl = computed(() => toWikiUrl(task.value?.wikiLink));
  const taskTitleComponent = computed(() => (taskWikiUrl.value ? 'a' : 'div'));
  const taskTitleProps = computed(() => {
    if (taskWikiUrl.value) {
      return {
        href: taskWikiUrl.value,
        target: '_blank',
        rel: 'noopener noreferrer',
      };
    }
    return {};
  });
  const taskTitleClass = computed(() => {
    const base = 'flex min-w-0 max-w-full items-center gap-1 text-sm leading-snug font-semibold';
    if (taskWikiUrl.value) {
      return `${base} text-link hover:text-link-hover no-underline`;
    }
    return `${base} text-gray-100`;
  });
  const linkButtonClass = [
    'inline-flex items-center justify-center rounded p-1 transition-colors',
    'text-surface-400 hover:text-surface-200 hover:bg-white/10',
    'focus-visible:ring-primary-500 focus-visible:ring-offset-surface-900',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  ];
  const isComplete = computed(() => tarkovStore.isTaskObjectiveComplete(props.objectiveId));
  const requiredCount = computed(() => objective.value?.count ?? 1);
  const currentCount = computed(() => tarkovStore.getObjectiveCount(props.objectiveId));
  // Check if parent task is complete or failed (locked state)
  const isParentTaskLocked = computed(() => {
    const taskId = objective.value?.taskId;
    if (!taskId) return false;
    const isTaskComplete = tarkovStore.isTaskComplete(taskId);
    const isTaskFailed = tarkovStore.isTaskFailed(taskId);
    return isTaskComplete || isTaskFailed;
  });
  // Disable toggle button when parent task is locked or readOnly
  const isToggleDisabled = computed(() => props.readOnly || isParentTaskLocked.value);
  const setTaskObjectiveCount = (goal: TaskObjective, complete: boolean): void => {
    const required = goal.count ?? 1;
    if (required > 1) tarkovStore.setObjectiveCount(goal.id, complete ? required : Math.max(0, required - 1));
  };
  const toggleTaskObjective = (goal: TaskObjective): void => {
    if (isToggleDisabled.value) return;
    const complete = tarkovStore.isTaskObjectiveComplete(goal.id);
    if (complete) tarkovStore.setTaskObjectiveUncomplete(goal.id);
    else tarkovStore.setTaskObjectiveComplete(goal.id);
    setTaskObjectiveCount(goal, !complete);
  };
  const toggleObjective = (): void => {
    if (objective.value) toggleTaskObjective(objective.value);
  };
  /**
   * Scrolls to the objective in the task list and highlights it.
   * Only highlights objectives, never task cards.
   * Always uses query params to trigger the scroll/highlight via tasks.vue,
   * ensuring the highlight happens even if this tooltip unmounts (e.g., from hover ending).
   */
  const scrollToObjective = () => {
    if (!task.value) return;
    if (!router) {
      logger.warn('LeafletObjectiveTooltip: router not available, cannot scroll to objective');
      return;
    }
    const currentQuery = { ...router.currentRoute.value.query };
    router.replace({
      query: {
        ...currentQuery,
        task: task.value.id,
        highlightObjective: props.objectiveId,
      },
    });
  };
</script>
