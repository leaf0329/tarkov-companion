import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { useLeafletMap } from '@/composables/useLeafletMap';
import type { TarkovMap } from '@/types/tarkov';
describe('Leaflet map layer lifecycle', () => {
  it('keeps real map pan and zoom usable after repeated floor and imagery changes', async () => {
    Object.defineProperty(window, 'companion', { value: {}, configurable: true });
    const map = ref({
      id: 'floor-fixture',
      name: 'Floor fixture',
      tile: {
        tilePath: '/fixture/a/{z}/{x}/{y}.webp',
        floorTilePaths: { upper: '/fixture/b/{z}/{x}/{y}.webp' },
        floors: ['ground', 'upper'],
        defaultFloor: 'ground',
        coordinateRotation: 0,
        transform: [1, 128, 1, 128],
        bounds: [
          [-100, -100],
          [100, 100],
        ],
        minZoom: 0,
        maxZoom: 6,
      },
    } as TarkovMap);
    let result!: ReturnType<typeof useLeafletMap>;
    const wrapper = mount(
      defineComponent({
        setup() {
          const container = ref<HTMLElement | null>(null);
          result = useLeafletMap({ containerRef: container, map, enableIdleDetection: false });
          return () => h('div', { ref: container });
        },
      }),
      { attachTo: document.body }
    );
    Object.defineProperties(wrapper.element, {
      clientWidth: { value: 600 },
      clientHeight: { value: 400 },
    });
    try {
      await flushPromises();
      await vi.waitFor(() => expect(result.isLoading.value).toBe(false));
      const owner = result.mapInstance.value!;
      expect(owner).not.toBeNull();
      for (const floor of ['upper', 'ground', 'upper']) {
        result.setFloor(floor);
        await nextTick();
        await flushPromises();
        expect(() => owner.setView([12, 18], 3, { animate: false })).not.toThrow();
        owner.panTo([15, 22], { animate: false });
        expect(owner.getCenter().lat).toBeCloseTo(15);
      }
      const before = owner.getCenter();
      map.value = {
        ...map.value,
        tile: { ...map.value.tile!, tilePath: '/fixture/c/{z}/{x}/{y}.webp' },
      };
      await nextTick();
      await flushPromises();
      expect(result.selectedFloor.value).toBe('upper');
      expect(owner.getCenter()).toEqual(before);
      expect(() => owner.setView([25, 30], 4, { animate: false })).not.toThrow();
      expect(owner.getCenter().lng).toBeCloseTo(30);
    } finally {
      wrapper.unmount();
      delete window.companion;
    }
  });
});
