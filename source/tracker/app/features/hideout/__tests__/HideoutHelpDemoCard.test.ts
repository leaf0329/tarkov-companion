import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import HideoutHelpDemoCard from '@/features/hideout/HideoutHelpDemoCard.vue';
const { demoStation } = vi.hoisted(() => ({
  demoStation: {
    id: 'workbench',
    imageLink: '/workbench.png',
    levels: [
      {
        constructionTime: 0,
        crafts: [],
        id: 'workbench-level-1',
        itemRequirements: [
          {
            count: 2,
            id: 'req-phase-relay',
            item: {
              backgroundColor: 'green',
              iconLink: '/phase-relay.webp',
              id: 'phase-relay',
              name: 'Phase control relay',
            },
            quantity: 2,
          },
          {
            count: 1,
            id: 'req-toolset',
            item: {
              backgroundColor: 'orange',
              iconLink: '/toolset.webp',
              id: 'toolset',
              name: 'Toolset',
            },
            quantity: 1,
          },
        ],
        level: 1,
        skillRequirements: [],
        stationLevelRequirements: [],
        traderRequirements: [],
      },
      {
        constructionTime: 0,
        crafts: [],
        id: 'workbench-level-2',
        itemRequirements: [
          {
            count: 3,
            id: 'req-bulb',
            item: {
              backgroundColor: 'yellow',
              iconLink: '/bulb.webp',
              id: 'light-bulb',
              name: 'Light bulb',
            },
            quantity: 3,
          },
        ],
        level: 2,
        skillRequirements: [
          {
            id: 'skill-crafting',
            level: 2,
            name: 'Crafting',
            skill: {
              id: 'crafting',
              name: 'Crafting',
            },
          },
        ],
        stationLevelRequirements: [
          {
            id: 'station-generator',
            level: 2,
            station: {
              id: 'generator',
              name: 'Generator',
            },
          },
        ],
        traderRequirements: [
          {
            id: 'trader-mechanic',
            trader: {
              id: 'mechanic',
              name: 'Mechanic',
            },
            value: 2,
          },
        ],
      },
    ],
    name: 'Workbench',
    normalizedName: 'workbench',
  },
}));
const translations: Record<string, string> = {
  'hideout.collapse': 'Collapse',
  'page.hideout.stationcard.level_not_ready': 'Not ready',
  'page.hideout.stationcard.max_level': 'Max station level reached',
  'page.hideout.stationcard.next_level': 'Requirements for next level',
  'page.hideout.stationcard.prerequisites': 'Prerequisites',
};
vi.mock('@/stores/useMetadata', () => ({
  useMetadataStore: () => ({
    hideoutStations: ref([demoStation]),
  }),
}));
vi.mock('@/utils/formatters', () => ({
  useLocaleNumberFormatter: () => (value: number) => value.toString(),
}));
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => translations[key] ?? key,
}));
const UButtonStub = {
  inheritAttrs: false,
  template: '<button v-bind="$attrs"><slot /></button>',
};
const GameItemStub = {
  inheritAttrs: false,
  props: ['itemName'],
  template: '<div v-bind="$attrs">{{ itemName }}</div>',
};
const I18nTStub = {
  template:
    '<span><slot name="level" /><slot name="stationname" /><slot name="skillname" /><slot name="tradername" /><slot name="loyaltylevel" /></span>',
};
describe('HideoutHelpDemoCard', () => {
  it('renders metadata-backed requirement details for the available demo state', async () => {
    const wrapper = await mountSuspended(HideoutHelpDemoCard, {
      props: {
        mode: 'available',
        requirementComplete: false,
      },
      global: {
        stubs: {
          GameItem: GameItemStub,
          UBadge: true,
          UButton: UButtonStub,
          UIcon: true,
          'i18n-t': I18nTStub,
        },
      },
    });
    expect(wrapper.text()).toContain('Phase control relay');
    expect(wrapper.text()).toContain('Toolset');
  });
  it('shows the locked badge instead of the maxed copy for locked mode', async () => {
    const wrapper = await mountSuspended(HideoutHelpDemoCard, {
      props: {
        mode: 'locked',
        requirementComplete: true,
      },
      global: {
        stubs: {
          GameItem: GameItemStub,
          UBadge: true,
          UButton: UButtonStub,
          UIcon: true,
          'i18n-t': I18nTStub,
        },
      },
    });
    expect(wrapper.text()).toContain('Not ready');
    expect(wrapper.text()).not.toContain('Max station level reached');
  });
  it('shows a completion footer for the built state', async () => {
    const wrapper = await mountSuspended(HideoutHelpDemoCard, {
      props: {
        mode: 'built',
        requirementComplete: true,
      },
      global: {
        stubs: {
          GameItem: GameItemStub,
          UBadge: true,
          UButton: UButtonStub,
          UIcon: true,
          'i18n-t': I18nTStub,
        },
      },
    });
    expect(wrapper.text()).toContain('Upgrade complete');
    expect(wrapper.text()).not.toContain('Max station level reached');
  });
});
