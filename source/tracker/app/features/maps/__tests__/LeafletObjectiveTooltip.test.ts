import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import type { Task, TaskObjective } from '@/types/tarkov';
type MockTask = Pick<Task, 'id' | 'name' | 'objectives' | 'requiredKeys'> & {
  wikiLink?: string | null;
};
const setup = async (
  task: MockTask,
  extraProps: Record<string, unknown> = {},
  objectiveOverrides: Partial<TaskObjective> = {}
) => {
  const metadataStore = {
    objectives: task.objectives?.length ? task.objectives.map((goal) => ({ ...goal, taskId: task.id })) : [
      {
        id: 'obj-1',
        taskId: task.id,
        description: 'Find the location',
        count: 1,
        ...objectiveOverrides,
      },
    ],
    tasks: [task],
  };
  const tarkovStore = {
    isTaskObjectiveComplete: vi.fn(() => false),
    getObjectiveCount: vi.fn(() => 0),
    isTaskComplete: vi.fn(() => false),
    isTaskFailed: vi.fn(() => false),
    setTaskObjectiveUncomplete: vi.fn(),
    setObjectiveCount: vi.fn(),
    setTaskObjectiveComplete: vi.fn(),
  };
  vi.doMock('@/stores/useMetadata', () => ({
    useMetadataStore: () => metadataStore,
  }));
  vi.doMock('@/stores/useTarkov', () => ({
    useTarkovStore: () => tarkovStore,
  }));
  vi.doMock('@/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
  }));
  const { default: LeafletObjectiveTooltip } =
    await import('@/features/maps/LeafletObjectiveTooltip.vue');
  const onClose = vi.fn();
  const wrapper = mount(LeafletObjectiveTooltip, {
    props: {
      objectiveId: 'obj-1',
      onClose,
      ...extraProps,
    },
    global: {
      provide: {
        router: {
          currentRoute: {
            value: {
              query: {},
            },
          },
          replace: vi.fn(),
        },
      },
      stubs: {
        AppTooltip: {
          template: '<span><slot /></span>',
        },
        UIcon: true,
      },
    },
  });
  return { onClose, wrapper, tarkovStore };
};
describe('LeafletObjectiveTooltip', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  it('renders wiki and Tarkov.dev task links in objective tooltip', async () => {
    const { wrapper } = await setup({
      id: 'task-1',
      name: 'Operation Aquarius',
      wikiLink: 'https://escapefromtarkov.fandom.com/wiki/Operation_Aquarius',
    });
    const wikiLinks = wrapper.findAll(
      'a[href="https://escapefromtarkov.fandom.com/wiki/Operation_Aquarius"]'
    );
    expect(wikiLinks.length).toBeGreaterThan(0);
    const tarkovDevLink = wrapper.find('a[href="https://tarkov.dev/task/task-1"]');
    expect(tarkovDevLink.exists()).toBe(true);
    expect(tarkovDevLink.attributes('target')).toBe('_blank');
    expect(tarkovDevLink.attributes('rel')).toContain('noopener');
    expect(tarkovDevLink.attributes('rel')).toContain('noreferrer');
    expect(wrapper.find('[data-testid="objective-required-keys"]').exists()).toBe(false);
  });
  it('renders Tarkov.dev task link when task has no wiki link', async () => {
    const { wrapper } = await setup({
      id: 'task-2',
      name: 'No Wiki Task',
      wikiLink: null,
    });
    expect(wrapper.find('a[href="https://tarkov.dev/task/task-2"]').exists()).toBe(true);
    expect(wrapper.find('a[href*="escapefromtarkov.fandom.com/wiki/"]').exists()).toBe(false);
  });
  it('renders the task title as plain text when the wiki link is untrusted', async () => {
    const { wrapper } = await setup({
      id: 'task-3',
      name: 'Untrusted Wiki Task',
      wikiLink: 'javascript:alert(1)',
    });
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'));
    expect(hrefs).toEqual(['https://tarkov.dev/task/task-3']);
  });
  it('emits close when the tooltip close button is clicked', async () => {
    const { onClose, wrapper } = await setup({
      id: 'task-3',
      name: 'Focused Task',
      wikiLink: null,
    });
    await wrapper.get('[data-testid="objective-close-button"]').trigger('click');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
  it('omits map hide controls unless the page provides them', async () => {
    const { wrapper } = await setup({ id: 'task-1', name: 'Task' });
    expect(wrapper.find('[data-testid="objective-hide-task"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="objective-show-only-task"]').exists()).toBe(false);
  });
  it('hides the quest or shows only it from the marker popup', async () => {
    const taskVisibilityActions = { hideTask: vi.fn(), showOnlyTask: vi.fn() };
    const { wrapper, onClose } = await setup(
      { id: 'task-1', name: 'Task' },
      { taskVisibilityActions }
    );
    await wrapper.find('[data-testid="objective-show-only-task"]').trigger('click');
    expect(taskVisibilityActions.showOnlyTask).toHaveBeenCalledWith('task-1');
    await wrapper.find('[data-testid="objective-hide-task"]').trigger('click');
    expect(onClose).toHaveBeenCalled();
    expect(taskVisibilityActions.hideTask).toHaveBeenCalledWith('task-1');
  });
  it('shows a full key name and trusted item link for an objective-only requirement', async () => {
    const { wrapper } = await setup(
      { id: 'task-1', name: 'Task' },
      { t: (key: string) => key },
      {
        requiredKeys: [
          [
            {
              id: 'key-206',
              name: 'Dorm room 206 key',
              shortName: '206',
              wikiLink: 'javascript:alert(1)',
            },
          ],
        ],
      }
    );
    const section = wrapper.get('[data-testid="objective-required-keys"]');
    expect(section.text()).toContain('Dorm room 206 key');
    expect(section.text()).toContain('companion.required_key');
    const link = section.get('a');
    expect(link.attributes('href')).toBe('https://tarkov.dev/item/key-206');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toContain('noopener');
  });
  it('includes keys on other task goals and labels alternatives and optional keys on this map', async () => {
    const { wrapper } = await setup(
      {
        id: 'task-1',
        name: 'Task',
        objectives: [
          { id: 'obj-1', description: 'First goal without keys', type: 'visit' },
          {
            id: 'obj-2',
            type: 'visit',
            maps: [{ id: 'customs' }],
            requiredKeys: [
              [
                { id: 'key-a', name: 'Key A' },
                { id: 'key-b', name: 'Key B' },
              ],
              [{ id: 'key-c', name: 'Key C' }],
            ],
          },
          {
            id: 'obj-3',
            type: 'visit',
            optional: true,
            maps: [{ id: 'customs' }],
            requiredKeys: [[{ id: 'key-optional', name: 'Optional key' }]],
          },
          {
            id: 'obj-4',
            type: 'visit',
            maps: [{ id: 'shoreline' }],
            requiredKeys: [[{ id: 'key-other', name: 'Other map key' }]],
          },
        ],
      },
      { mapIds: ['customs'], t: (key: string) => key }
    );
    const groups = wrapper.findAll('[data-testid="objective-key-group"]');
    expect(groups).toHaveLength(3);
    expect(groups[0]!.text()).toContain('companion.keys_any');
    expect(groups[0]!.text()).toContain('companion.keys_or');
    expect(groups[0]!.findAll('a')).toHaveLength(2);
    expect(groups[1]!.text()).toContain('Key C');
    expect(groups[1]!.text()).not.toContain('companion.keys_any');
    expect(groups[2]!.attributes('data-optional')).toBe('true');
    expect(groups[2]!.text()).toContain('companion.optional_key');
    expect(wrapper.text()).not.toContain('Other map key');
  });
  it('supports task key groups requiring all keys and merged map aliases', async () => {
    const { wrapper } = await setup(
      {
        id: 'task-1',
        name: 'Task',
        requiredKeys: [
          {
            maps: [{ id: 'factory-night' }],
            anyOf: false,
            keys: [
              { id: 'key-a', name: 'Key A' },
              { id: 'key-b', name: 'Key B' },
            ],
          },
        ],
      },
      { mapIds: ['factory', 'factory-night'], t: (key: string) => key }
    );
    const section = wrapper.get('[data-testid="objective-required-keys"]');
    expect(section.text()).toContain('companion.keys_all');
    expect(section.text()).toContain('companion.keys_and');
    expect(section.text()).not.toContain('companion.keys_or');
  });
  it('shows all camera placements and the kill requirement in a full task popup', async () => {
    const objectives: TaskObjective[] = [
      ...['first', 'second', 'third', 'fourth'].map((number, index) => ({ id: `obj-${index + 1}`, description: `Place the ${number} camera`, count: 1, type: 'plantItem', items: [{ id: 'camera', name: 'Wi-Fi camera' }] })),
      { id: 'obj-5', description: 'Eliminate targets in the workshop', count: 15, type: 'shoot' },
    ];
    const { wrapper } = await setup({ id: 'task-1', name: 'Provide Viewership', objectives }, { fullTask: true });
    expect(wrapper.findAll('[data-testid=task-objective-row]')).toHaveLength(1);
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    const rows = wrapper.findAll('[data-testid=task-objective-row]');
    expect(rows).toHaveLength(5);
    for (const [index, goal] of objectives.entries()) expect(rows[index]!.text()).toContain(goal.description);
    expect(rows[4]!.get('[data-testid=task-objective-count]').text()).toBe('0/15');
    expect(rows[0]!.text()).toContain('Wi-Fi camera');
    expect(wrapper.get('[data-testid=objective-popup-body]').find('[data-testid=objective-close-button]').exists()).toBe(false);
  });
  it('toggles the chosen goal instead of the marker representative in a full task popup', async () => {
    const { wrapper, tarkovStore } = await setup({ id: 'task-1', name: 'Task', objectives: [
      { id: 'obj-1', description: 'Place a camera', count: 1 },
      { id: 'obj-2', description: 'Eliminate targets', count: 15 },
    ] }, { fullTask: true });
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    await wrapper.get('[data-objective-id=obj-2] [data-testid=task-objective-toggle]').trigger('click');
    expect(tarkovStore.setTaskObjectiveComplete).toHaveBeenCalledExactlyOnceWith('obj-2');
    expect(tarkovStore.setObjectiveCount).toHaveBeenCalledWith('obj-2', 15);
  });
  it('includes handover goals, optional goals and keys for another map in a full task popup', async () => {
    const { wrapper } = await setup({ id: 'task-1', name: 'Task', objectives: [
      { id: 'obj-1', description: 'Find the package', maps: [{ id: 'customs', name: 'Customs' }] },
      { id: 'obj-2', description: 'Hand over the package', type: 'giveItem', count: 3 },
      { id: 'obj-3', description: 'Visit the locked room', optional: true, maps: [{ id: 'shoreline', name: 'Shoreline' }], requiredKeys: [[{ id: 'key-a', name: 'Other map key' }]] },
    ] }, { fullTask: true, mapIds: ['customs'], t: (key: string) => key });
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    expect(wrapper.findAll('[data-testid=task-objective-row]')).toHaveLength(3);
    expect(wrapper.get('[data-objective-id=obj-2]').text()).toContain('0/3');
    expect(wrapper.get('[data-objective-id=obj-3]').text()).toContain('common.optional');
    expect(wrapper.get('[data-testid=objective-required-keys]').text()).toContain('Other map key');
    expect(wrapper.get('[data-testid=objective-required-keys]').text()).toContain('Shoreline');
  });
  it('keeps all goals visible without completion buttons for read-only task popups', async () => {
    const { wrapper } = await setup({ id: 'task-1', name: 'Task', objectives: [
      { id: 'obj-1', description: 'First goal' }, { id: 'obj-2', description: 'Second goal' },
    ] }, { fullTask: true, readOnly: true });
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    expect(wrapper.findAll('[data-testid=task-objective-row]')).toHaveLength(2);
    expect(wrapper.find('[data-testid=task-objective-toggle]').exists()).toBe(false);
  });
  it('opens the selected bunker branch and only expands other branches on request', async () => {
    const { wrapper } = await setup({ id: 'task-1', name: 'The Bunker', objectives: [
      { id: 'obj-1', description: 'Find the airtight door to White Bishop' },
      { id: 'obj-2', description: 'Find either airtight door to Black Bishop' },
      { id: 'obj-3', description: 'Find either airtight door to Black Pawn' },
    ] }, { fullTask: true, objectiveId: 'obj-2', t: (key: string) => key });
    const rows = () => wrapper.findAll('[data-testid=task-objective-row]');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.attributes('data-objective-id')).toBe('obj-2');
    expect(rows()[0]!.text()).toContain('2. Find either airtight door to Black Bishop');
    expect(wrapper.text()).not.toContain('White Bishop');
    expect(wrapper.get('[data-testid=current-point-label]').text()).toBe('companion.current_point');
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    expect(rows()).toHaveLength(3);
    expect(wrapper.get('[data-current-objective=true]').attributes('data-objective-id')).toBe('obj-2');
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    expect(rows()).toHaveLength(1);
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    await wrapper.setProps({ objectiveId: 'obj-3' });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.text()).toContain('Black Pawn');
    expect(wrapper.get('[data-testid=task-objectives-expand]').attributes('aria-expanded')).toBe('false');
  });
  it('completes only the clicked branch and shows its equipment and keys', async () => {
    const { wrapper, tarkovStore } = await setup({ id: 'task-1', name: 'Task', objectives: [
      { id: 'obj-1', description: 'Open the first room', requiredKeys: [[{ id: 'key-a', name: 'First room key' }]] },
      { id: 'obj-2', description: 'Place cameras in the second room', type: 'plantItem', count: 2, items: [{ id: 'camera', name: 'Wi-Fi camera' }], requiredKeys: [[{ id: 'key-b', name: 'Second room key' }]] },
    ] }, { fullTask: true, objectiveId: 'obj-2' });
    expect(wrapper.text()).toContain('Wi-Fi camera');
    expect(wrapper.text()).toContain('Second room key');
    expect(wrapper.text()).not.toContain('First room key');
    await wrapper.get('[data-testid=task-objective-toggle]').trigger('click');
    expect(tarkovStore.setTaskObjectiveComplete).toHaveBeenCalledExactlyOnceWith('obj-2');
    expect(tarkovStore.setObjectiveCount).toHaveBeenCalledExactlyOnceWith('obj-2', 2);
    await wrapper.get('[data-testid=task-objectives-expand]').trigger('click');
    expect(wrapper.text()).toContain('First room key');
    expect(wrapper.text()).toContain('Second room key');
  });
  it('omits the expand control when the task has only one objective', async () => {
    const { wrapper } = await setup({ id: 'task-1', name: 'Task', objectives: [
      { id: 'obj-1', description: 'Find the one location' },
    ] }, { fullTask: true });
    expect(wrapper.findAll('[data-testid=task-objective-row]')).toHaveLength(1);
    expect(wrapper.find('[data-testid=task-objectives-expand]').exists()).toBe(false);
    expect(wrapper.text().match(/Find the one location/g)).toHaveLength(1);
  });
  it('resizes the scrolling body with the map while the close button stays outside it', async () => {
    const viewportHeight = ref(300);
    const { wrapper } = await setup({ id: 'task-1', name: 'Task', objectives: [
      { id: 'obj-1', description: 'First goal' }, { id: 'obj-2', description: 'Second goal' },
    ] }, { fullTask: true, viewportHeight });
    const body = wrapper.get('[data-testid=objective-popup-body]');
    const originalHeight = parseFloat((body.element as HTMLElement).style.maxHeight);
    viewportHeight.value = 180;
    await nextTick();
    const resizedHeight = parseFloat((body.element as HTMLElement).style.maxHeight);
    expect(resizedHeight).toBeLessThan(originalHeight);
    expect(resizedHeight).toBeLessThan(viewportHeight.value - 60);
    expect(body.find('[data-testid=objective-close-button]').exists()).toBe(false);
    expect(wrapper.find('[data-testid=objective-popup-header] [data-testid=objective-close-button]').exists()).toBe(true);
  });
});
