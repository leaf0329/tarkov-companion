import { describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import type {
  NeededItemHideoutModule,
  NeededItemTaskObjective,
  Task,
  TaskObjective,
  Trader,
} from '@/types/tarkov';
const createTasks = (): Task[] => [
  {
    id: 'task-a',
    name: 'Task A',
    kappaRequired: true,
    factionName: 'Any',
    trader: { id: 'trader-1', name: 'Trader One' },
    objectives: [{ id: 'obj-a', taskId: 'task-a' }],
  },
  {
    id: 'task-b',
    name: 'Task B',
    lightkeeperRequired: true,
    factionName: 'Any',
    trader: { id: 'trader-1', name: 'Trader One' },
    objectives: [{ id: 'obj-b', taskId: 'task-b' }],
  },
  {
    id: 'task-c',
    name: 'Task C',
    factionName: 'Any',
    trader: { id: 'trader-2', name: 'Trader Two' },
    objectives: [{ id: 'obj-c', taskId: 'task-c' }],
  },
  {
    id: 'task-d',
    name: 'Task D',
    factionName: 'Any',
    trader: { id: 'trader-2', name: 'Trader Two' },
    objectives: [{ id: 'obj-d', taskId: 'task-d' }],
  },
];
const createObjectives = (): TaskObjective[] => [
  {
    id: 'obj-a',
    taskId: 'task-a',
    type: 'giveItem',
    count: 1,
    item: { id: 'item-a', name: 'Item A' },
  },
  {
    id: 'obj-b',
    taskId: 'task-b',
    type: 'giveItem',
    count: 2,
    item: { id: 'item-b', name: 'Item B' },
  },
  {
    id: 'obj-c',
    taskId: 'task-c',
    type: 'giveItem',
    count: 1,
    item: { id: 'item-c', name: 'Item C' },
  },
  {
    id: 'obj-d',
    taskId: 'task-d',
    type: 'giveItem',
    count: 1,
    item: { id: 'item-d', name: 'Item D' },
  },
];
const createProgressStore = () => ({
  invalidTasks: {
    'task-d': { self: true },
  } as Record<string, { self: boolean }>,
  objectiveCompletions: {
    'obj-a': { self: true },
    'obj-b': { self: false },
  } as Record<string, { self: boolean }>,
  moduleCompletions: undefined as Record<string, Record<string, boolean>> | undefined,
});
const createTarkovStore = (
  overrides: {
    completedTasks?: Set<string>;
    failedTasks?: Set<string>;
    completedObjectives?: Set<string>;
    getObjectiveCount?: (objectiveId: string) => number;
    getHideoutPartCount?: (partId: string) => number;
    isHideoutPartComplete?: (partId: string) => boolean;
    isTaskComplete?: (taskId: string) => boolean;
    isTaskFailed?: (taskId: string) => boolean;
    isTaskObjectiveComplete?: (objectiveId: string) => boolean;
  } = {}
) => {
  const completedTasks = overrides.completedTasks ?? new Set(['task-a', 'task-c']);
  const failedTasks = overrides.failedTasks ?? new Set(['task-b']);
  const completedObjectives = overrides.completedObjectives ?? new Set(['obj-a']);
  return {
    isTaskComplete: overrides.isTaskComplete ?? ((taskId: string) => completedTasks.has(taskId)),
    isTaskFailed: overrides.isTaskFailed ?? ((taskId: string) => failedTasks.has(taskId)),
    isTaskObjectiveComplete:
      overrides.isTaskObjectiveComplete ??
      ((objectiveId: string) => completedObjectives.has(objectiveId)),
    getPMCFaction: () => 'USEC',
    getGameEdition: () => 1,
    getPrestigeLevel: () => 0,
    getObjectiveCount: overrides.getObjectiveCount ?? (() => 0),
    getHideoutPartCount: overrides.getHideoutPartCount ?? (() => 0),
    isHideoutPartComplete: overrides.isHideoutPartComplete ?? (() => false),
  };
};
const createPreferencesStore = () => ({
  getHideNonKappaTasks: false,
  getShowLightkeeperTasks: true,
  getShowNonSpecialTasks: true,
});
type PreferencesStoreMock = ReturnType<typeof createPreferencesStore>;
interface SetupOverrides {
  tasks?: Task[];
  objectives?: TaskObjective[];
  neededItemTaskObjectives?: NeededItemTaskObjective[];
  neededItemHideoutModules?: NeededItemHideoutModule[];
  traders?: Trader[];
  progressStore?: Partial<ReturnType<typeof createProgressStore>>;
  tarkovStore?: ReturnType<typeof createTarkovStore>;
  preferencesStore?: PreferencesStoreMock;
}
const setup = async (overrides: SetupOverrides = {}) => {
  const tasks = overrides.tasks ?? createTasks();
  const objectives = overrides.objectives ?? createObjectives();
  const neededItemTaskObjectives =
    overrides.neededItemTaskObjectives ??
    objectives.map((objective) => ({
      id: objective.id,
      needType: 'taskObjective' as const,
      taskId: objective.taskId ?? '',
      type: objective.type,
      item: objective.item ?? { id: objective.id, name: objective.id },
      count: objective.count ?? 1,
      foundInRaid: objective.foundInRaid ?? false,
    }));
  const neededItemHideoutModules = overrides.neededItemHideoutModules ?? [];
  const traders = overrides.traders ?? [
    { id: 'trader-1', name: 'Trader One' },
    { id: 'trader-2', name: 'Trader Two' },
  ];
  const metadataStore = {
    tasks,
    objectives,
    traders,
    sortedTraders: traders,
    editions: [],
    neededItemTaskObjectives,
    neededItemHideoutModules,
    prestigeTaskMap: new Map<string, number>(),
    getExcludedTaskIdsForEdition: () => new Set<string>(),
  };
  const progressStore = { ...createProgressStore(), ...overrides.progressStore };
  const tarkovStore = overrides.tarkovStore ?? createTarkovStore();
  const preferencesStore = overrides.preferencesStore ?? createPreferencesStore();
  vi.resetModules();
  vi.doMock('@/stores/useMetadata', () => ({
    useMetadataStore: () => metadataStore,
  }));
  vi.doMock('@/stores/useProgress', () => ({
    useProgressStore: () => progressStore,
  }));
  vi.doMock('@/stores/useTarkov', () => ({
    useTarkovStore: () => tarkovStore,
  }));
  vi.doMock('@/stores/usePreferences', () => ({
    usePreferencesStore: () => preferencesStore,
  }));
  const { useDashboardStats } = await import('@/composables/useDashboardStats');
  return {
    dashboardStats: useDashboardStats(),
  };
};
describe('useDashboardStats', () => {
  it('calculates task totals and failures correctly', async () => {
    const { dashboardStats } = await setup();
    expect(dashboardStats.totalTasks.value).toBe(2);
    expect(dashboardStats.completedTasks.value).toBe(2);
    expect(dashboardStats.failedTasksCount.value).toBe(1);
  });
  it('calculates kappa and lightkeeper stats', async () => {
    const { dashboardStats } = await setup();
    expect(dashboardStats.totalKappaTasks.value).toBe(1);
    expect(dashboardStats.completedKappaTasks.value).toBe(1);
    expect(dashboardStats.totalLightkeeperTasks.value).toBe(0);
    expect(dashboardStats.completedLightkeeperTasks.value).toBe(0);
  });
  it('builds trader stats excluding invalid and failed tasks', async () => {
    const { dashboardStats } = await setup();
    expect(dashboardStats.traderStats.value).toEqual([
      {
        id: 'trader-1',
        name: 'Trader One',
        imageLink: undefined,
        totalTasks: 1,
        completedTasks: 1,
        percentage: 100,
      },
      {
        id: 'trader-2',
        name: 'Trader Two',
        imageLink: undefined,
        totalTasks: 1,
        completedTasks: 1,
        percentage: 100,
      },
    ]);
  });
  it('returns zero counters when tasks array is empty', async () => {
    const { dashboardStats } = await setup({
      tasks: [],
      objectives: [],
      traders: [],
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        isTaskComplete: () => false,
        isTaskFailed: () => false,
        isTaskObjectiveComplete: () => false,
      }),
    });
    expect(dashboardStats.totalTasks.value).toBe(0);
    expect(dashboardStats.completedTasks.value).toBe(0);
    expect(dashboardStats.failedTasksCount.value).toBe(0);
    expect(dashboardStats.totalKappaTasks.value).toBe(0);
    expect(dashboardStats.totalLightkeeperTasks.value).toBe(0);
    expect(dashboardStats.traderStats.value).toEqual([]);
  });
  it('handles all tasks invalid or failed correctly', async () => {
    const tasks: Task[] = [
      {
        id: 'task-fail-1',
        name: 'Failed Task 1',
        factionName: 'Any',
        trader: { id: 'trader-1', name: 'Trader One' },
        objectives: [{ id: 'obj-fail-1', taskId: 'task-fail-1' }],
      },
      {
        id: 'task-fail-2',
        name: 'Failed Task 2',
        factionName: 'Any',
        trader: { id: 'trader-1', name: 'Trader One' },
        objectives: [{ id: 'obj-fail-2', taskId: 'task-fail-2' }],
      },
    ];
    const { dashboardStats } = await setup({
      tasks,
      objectives: [],
      traders: [{ id: 'trader-1', name: 'Trader One' }],
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        isTaskComplete: () => false,
        isTaskFailed: () => true,
        isTaskObjectiveComplete: () => false,
      }),
    });
    expect(dashboardStats.totalTasks.value).toBe(0);
    expect(dashboardStats.completedTasks.value).toBe(0);
    expect(dashboardStats.failedTasksCount.value).toBe(2);
  });
  it('handles traders with zero valid tasks safely (no division by zero)', async () => {
    const tasks: Task[] = [
      {
        id: 'task-invalid',
        name: 'Invalid Task',
        factionName: 'Any',
        trader: { id: 'trader-1', name: 'Trader One' },
        objectives: [{ id: 'obj-invalid', taskId: 'task-invalid' }],
      },
    ];
    const { dashboardStats } = await setup({
      tasks,
      objectives: [],
      traders: [{ id: 'trader-1', name: 'Trader One' }],
      progressStore: {
        invalidTasks: { 'task-invalid': { self: true } },
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        isTaskComplete: () => false,
        isTaskFailed: () => false,
        isTaskObjectiveComplete: () => false,
      }),
    });
    // traderStats filters out traders with zero tasks, so trader-1 should not be present
    const traderStat = dashboardStats.traderStats.value.find((t) => t.id === 'trader-1');
    expect(traderStat).toBeUndefined();
    // Verify empty traderStats when all tasks are invalid
    expect(dashboardStats.traderStats.value).toEqual([]);
  });
  it('uses needed-item objectives as the dashboard item source and stays reactive', async () => {
    const objectiveCounts = reactive<Record<string, number>>({
      'obj-a': 0,
      'obj-hidden': 5,
    });
    const objectives: TaskObjective[] = [
      {
        id: 'obj-a',
        taskId: 'task-a',
        type: 'giveItem',
        count: 2,
        item: { id: 'item-a', name: 'Item A' },
      },
      {
        id: 'obj-hidden',
        taskId: 'task-a',
        type: 'giveItem',
        count: 5,
        item: { id: 'item-hidden', name: 'Item Hidden' },
      },
    ];
    const neededItemTaskObjectives: NeededItemTaskObjective[] = [
      {
        id: 'obj-a',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-a', name: 'Item A' },
        count: 2,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      objectives,
      neededItemTaskObjectives,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getObjectiveCount: (objectiveId: string) => objectiveCounts[objectiveId] ?? 0,
      }),
    });
    expect(dashboardStats.totalTaskItems.value).toBe(2);
    expect(dashboardStats.completedTaskItems.value).toBe(0);
    objectiveCounts['obj-a'] = 1;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(1);
    objectiveCounts['obj-a'] = 2;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(2);
  });
  it('mirrors needed-items merged task item counting for duplicate objective entries', async () => {
    const objectiveCounts = reactive<Record<string, number>>({
      'obj-a': 0,
      'obj-b': 0,
    });
    const neededItemTaskObjectives: NeededItemTaskObjective[] = [
      {
        id: 'obj-a',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-shared', name: 'Shared Item' },
        count: 1,
        foundInRaid: false,
      },
      {
        id: 'obj-b',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-shared', name: 'Shared Item' },
        count: 1,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      neededItemTaskObjectives,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getObjectiveCount: (objectiveId: string) => objectiveCounts[objectiveId] ?? 0,
      }),
    });
    expect(dashboardStats.totalTaskItems.value).toBe(2);
    expect(dashboardStats.completedTaskItems.value).toBe(0);
    objectiveCounts['obj-a'] = 2;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(2);
    objectiveCounts['obj-a'] = 1;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(1);
  });
  it('mirrors needed-items merged task item counting when duplicate progress comes from obj-b', async () => {
    const objectiveCounts = reactive<Record<string, number>>({
      'obj-a': 0,
      'obj-b': 0,
    });
    const neededItemTaskObjectives: NeededItemTaskObjective[] = [
      {
        id: 'obj-a',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-shared', name: 'Shared Item' },
        count: 1,
        foundInRaid: false,
      },
      {
        id: 'obj-b',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-shared', name: 'Shared Item' },
        count: 1,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      neededItemTaskObjectives,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getObjectiveCount: (objectiveId: string) => objectiveCounts[objectiveId] ?? 0,
      }),
    });
    expect(dashboardStats.totalTaskItems.value).toBe(2);
    expect(dashboardStats.completedTaskItems.value).toBe(0);
    objectiveCounts['obj-b'] = 2;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(2);
    objectiveCounts['obj-b'] = 1;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(1);
  });
  it('requires all merged duplicate objectives complete before granting full completion credit', async () => {
    const objectiveCounts = reactive<Record<string, number>>({
      'obj-a': 0,
      'obj-b': 0,
    });
    const objectiveCompletions = reactive<Record<string, boolean>>({
      'obj-a': false,
      'obj-b': false,
    });
    const neededItemTaskObjectives: NeededItemTaskObjective[] = [
      {
        id: 'obj-a',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-shared', name: 'Shared Item' },
        count: 1,
        foundInRaid: false,
      },
      {
        id: 'obj-b',
        needType: 'taskObjective',
        taskId: 'task-a',
        type: 'giveItem',
        item: { id: 'item-shared', name: 'Shared Item' },
        count: 1,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      neededItemTaskObjectives,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getObjectiveCount: (objectiveId: string) => objectiveCounts[objectiveId] ?? 0,
        isTaskObjectiveComplete: (objectiveId: string) =>
          objectiveCompletions[objectiveId] ?? false,
      }),
    });
    expect(dashboardStats.totalTaskItems.value).toBe(2);
    expect(dashboardStats.completedTaskItems.value).toBe(0);
    objectiveCounts['obj-a'] = 1;
    objectiveCompletions['obj-a'] = true;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(1);
    objectiveCompletions['obj-b'] = true;
    await nextTick();
    expect(dashboardStats.completedTaskItems.value).toBe(2);
  });
  it('tracks hideout needed items and reacts to count changes', async () => {
    const hideoutCounts = reactive<Record<string, number>>({
      'hideout-req-a': 0,
    });
    const neededItemHideoutModules: NeededItemHideoutModule[] = [
      {
        id: 'hideout-req-a',
        needType: 'hideoutModule',
        hideoutModule: {
          id: 'hideout-module-a',
          stationId: 'station-a',
          level: 1,
          constructionTime: 0,
          itemRequirements: [],
          stationLevelRequirements: [],
          skillRequirements: [],
          traderRequirements: [],
          crafts: [],
          predecessors: [],
          successors: [],
          parents: [],
          children: [],
        },
        item: { id: 'hideout-item-a', name: 'Hideout Item A' },
        count: 4,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      neededItemHideoutModules,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getHideoutPartCount: (partId: string) => hideoutCounts[partId] ?? 0,
      }),
    });
    expect(dashboardStats.totalHideoutItems.value).toBe(4);
    expect(dashboardStats.completedHideoutItems.value).toBe(0);
    hideoutCounts['hideout-req-a'] = 2;
    await nextTick();
    expect(dashboardStats.completedHideoutItems.value).toBe(2);
    hideoutCounts['hideout-req-a'] = 4;
    await nextTick();
    expect(dashboardStats.completedHideoutItems.value).toBe(4);
  });
  it('counts completed module items as fully collected while keeping them in totals', async () => {
    const neededItemHideoutModules: NeededItemHideoutModule[] = [
      {
        id: 'hideout-req-a',
        needType: 'hideoutModule',
        hideoutModule: {
          id: 'hideout-module-a',
          stationId: 'station-a',
          level: 1,
          constructionTime: 0,
          itemRequirements: [],
          stationLevelRequirements: [],
          skillRequirements: [],
          traderRequirements: [],
          crafts: [],
          predecessors: [],
          successors: [],
          parents: [],
          children: [],
        },
        item: { id: 'hideout-item-a', name: 'Hideout Item A' },
        count: 4,
        foundInRaid: false,
      },
      {
        id: 'hideout-req-b',
        needType: 'hideoutModule',
        hideoutModule: {
          id: 'hideout-module-b',
          stationId: 'station-b',
          level: 1,
          constructionTime: 0,
          itemRequirements: [],
          stationLevelRequirements: [],
          skillRequirements: [],
          traderRequirements: [],
          crafts: [],
          predecessors: [],
          successors: [],
          parents: [],
          children: [],
        },
        item: { id: 'hideout-item-b', name: 'Hideout Item B' },
        count: 3,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      neededItemHideoutModules,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
        moduleCompletions: {
          'hideout-module-a': { self: true },
          'hideout-module-b': { self: false },
        },
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getHideoutPartCount: () => 0,
      }),
    });
    expect(dashboardStats.totalHideoutItems.value).toBe(7);
    expect(dashboardStats.completedHideoutItems.value).toBe(4);
  });
  it('excludes currency items from hideout item counts', async () => {
    const neededItemHideoutModules: NeededItemHideoutModule[] = [
      {
        id: 'hideout-req-a',
        needType: 'hideoutModule',
        hideoutModule: {
          id: 'hideout-module-a',
          stationId: 'station-a',
          level: 1,
          constructionTime: 0,
          itemRequirements: [],
          stationLevelRequirements: [],
          skillRequirements: [],
          traderRequirements: [],
          crafts: [],
          predecessors: [],
          successors: [],
          parents: [],
          children: [],
        },
        item: { id: '5449016a4bdc2d6f028b456f', name: 'Roubles' },
        count: 100000,
        foundInRaid: false,
      },
      {
        id: 'hideout-req-b',
        needType: 'hideoutModule',
        hideoutModule: {
          id: 'hideout-module-a',
          stationId: 'station-a',
          level: 1,
          constructionTime: 0,
          itemRequirements: [],
          stationLevelRequirements: [],
          skillRequirements: [],
          traderRequirements: [],
          crafts: [],
          predecessors: [],
          successors: [],
          parents: [],
          children: [],
        },
        item: { id: 'real-item', name: 'Bolts' },
        count: 5,
        foundInRaid: false,
      },
    ];
    const { dashboardStats } = await setup({
      neededItemHideoutModules,
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      tarkovStore: createTarkovStore({
        completedTasks: new Set(),
        failedTasks: new Set(),
        completedObjectives: new Set(),
        getHideoutPartCount: () => 0,
      }),
    });
    expect(dashboardStats.totalHideoutItems.value).toBe(5);
    expect(dashboardStats.completedHideoutItems.value).toBe(0);
  });
  it('excludes tasks without assigned traders from traderStats but counts in totals', async () => {
    const tasks: Task[] = [
      {
        id: 'task-no-trader',
        name: 'Task Without Trader',
        factionName: 'Any',
        trader: undefined,
        objectives: [{ id: 'obj-no-trader', taskId: 'task-no-trader' }],
      },
      {
        id: 'task-with-trader',
        name: 'Task With Trader',
        factionName: 'Any',
        trader: { id: 'trader-1', name: 'Trader One' },
        objectives: [{ id: 'obj-with-trader', taskId: 'task-with-trader' }],
      },
    ];
    const { dashboardStats } = await setup({
      tasks,
      objectives: [],
      traders: [{ id: 'trader-1', name: 'Trader One' }],
      progressStore: {
        invalidTasks: {},
        objectiveCompletions: {},
      },
      // Intentionally relies on Set-based isTaskComplete behavior via completedTasks override
      // rather than explicit isTaskComplete function to test the default Set lookup path
      tarkovStore: createTarkovStore({
        completedTasks: new Set(['task-no-trader', 'task-with-trader']),
        isTaskFailed: () => false,
        isTaskObjectiveComplete: () => false,
      }),
    });
    expect(dashboardStats.totalTasks.value).toBe(2);
    expect(dashboardStats.completedTasks.value).toBe(2);
    const traderStat = dashboardStats.traderStats.value.find((t) => t.id === 'trader-1');
    expect(traderStat?.totalTasks).toBe(1);
    expect(traderStat?.completedTasks).toBe(1);
  });
});
