import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { useCompanionMapInteraction } from '@/composables/useCompanionMapInteraction';
import type { CompanionWindowResetReason } from '@/types/companion';
import type L from 'leaflet';
describe('companion map input after interruption', () => {
  let callback: ((reason: CompanionWindowResetReason) => void) | undefined;
  const unsubscribe = vi.fn();
  const resetControls = vi.fn();
  const containers: HTMLElement[] = [];
  const wrappers: ReturnType<typeof mount>[] = [];
  const fixture = () => {
    const container = document.createElement('div');
    document.body.append(container);
    containers.push(container);
    const map = {
      dragging: { enabled: vi.fn(() => true), disable: vi.fn(), enable: vi.fn() },
      stop: vi.fn(), on: vi.fn(), off: vi.fn(), getContainer: () => container,
      panTo: vi.fn(), setView: vi.fn(), remove: vi.fn(),
    };
    const instance = shallowRef(map as unknown as L.Map);
    wrappers.push(mount(defineComponent({
      setup() { useCompanionMapInteraction(instance, resetControls); return () => null; },
    })));
    return { container, map, instance };
  };
  const pointer = (target: EventTarget, type: string, button = 0, buttons = 1) =>
    target.dispatchEvent(new PointerEvent(type, { button, buttons, bubbles: true, cancelable: true }));
  beforeEach(() => {
    vi.clearAllMocks();
    callback = undefined;
    Object.defineProperty(window, 'companion', { configurable: true, value: {
      subscribeWindowReset: (fn: typeof callback) => { callback = fn; return unsubscribe; },
    } });
  });
  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount());
    containers.splice(0).forEach(container => container.remove());
    delete window.companion;
  });
  it.each(['hide', 'show', 'minimize', 'restore', 'blur', 'resume'] as const)('releases interrupted input on native %s without changing the view', reason => {
    const { map } = fixture();
    callback?.(reason);
    expect(map.dragging.disable).toHaveBeenCalledOnce();
    expect(map.dragging.enable).toHaveBeenCalledOnce();
    expect(map.stop).toHaveBeenCalledOnce();
    expect(resetControls).toHaveBeenCalledOnce();
    expect(map.panTo).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
    expect(map.remove).not.toHaveBeenCalled();
  });
  it('releases a drag when the pointer comes back without a held button', () => {
    const { container, map } = fixture();
    pointer(container, 'pointerdown');
    pointer(container, 'pointermove');
    expect(map.stop).not.toHaveBeenCalled();
    pointer(container, 'pointermove', -1, 0);
    expect(map.stop).toHaveBeenCalledOnce();
    pointer(container, 'pointermove', -1, 0);
    expect(map.stop).toHaveBeenCalledOnce();
  });
  it('clears an old gesture before a fresh toolbar click without cancelling that click', () => {
    const { container, map } = fixture();
    pointer(container, 'pointerdown');
    const button = document.createElement('button');
    document.body.append(button); containers.push(button);
    expect(pointer(button, 'pointerdown')).toBe(true);
    expect(map.dragging.disable).toHaveBeenCalledOnce();
    expect(resetControls).toHaveBeenCalledOnce();
  });
  it.each(['pointercancel', 'lostpointercapture'])('releases mouse state after %s', event => {
    const { container, map } = fixture();
    pointer(container, 'pointerdown');
    pointer(container, event, -1, 0);
    expect(map.stop).toHaveBeenCalledOnce();
    expect(map.dragging.enable).toHaveBeenCalledOnce();
  });
  it('preserves an intentionally disabled drag handler', () => {
    const { map } = fixture();
    map.dragging.enabled.mockReturnValue(false);
    callback?.('restore');
    expect(map.dragging.enable).not.toHaveBeenCalled();
  });
  it('normal release does not reset on the next ordinary mouse move', () => {
    const { container, map } = fixture();
    pointer(container, 'pointerdown'); pointer(container, 'pointerup', 0, 0);
    pointer(container, 'pointermove', -1, 0);
    expect(map.stop).not.toHaveBeenCalled();
  });
  it('unsubscribes and detaches listeners when the page is removed', async () => {
    const { container, map } = fixture();
    const instance = wrappers[0]!;
    instance.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(map.off).toHaveBeenCalledWith('dragstart', expect.any(Function));
    pointer(container, 'pointerdown');
    await nextTick();
    expect(map.stop).not.toHaveBeenCalled();
  });
  it('leaves ordinary browser maps unchanged', () => {
    delete window.companion;
    const { container, map } = fixture();
    pointer(container, 'pointerdown'); window.dispatchEvent(new Event('blur'));
    expect(map.on).not.toHaveBeenCalled();
    expect(map.stop).not.toHaveBeenCalled();
    expect(callback).toBeUndefined();
  });
});
