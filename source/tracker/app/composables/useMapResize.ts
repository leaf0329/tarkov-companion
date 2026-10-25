import { useStorage, useWindowSize } from '@vueuse/core';
import type { Ref } from 'vue';
export type UseMapResizeOptions = {
  storageKey?: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeightRatio?: number;
  step?: number;
};
export interface UseMapResizeReturn {
  mapHeight: Ref<number>;
  mapHeightMax: Readonly<Ref<number>>;
  mapHeightMin: number;
  resizeHandleRef: Ref<HTMLElement | null>;
  isResizing: Readonly<Ref<boolean>>;
  startResize: (event: PointerEvent) => void;
  stopResize: () => void;
  onResizeKeydown: (event: KeyboardEvent) => void;
}
const MAP_HEIGHT_MIN = 320;
const MAP_HEIGHT_DEFAULT = 520;
const MAP_HEIGHT_MAX_FALLBACK = 1200;
const MAP_HEIGHT_STEP = 24;
export function useMapResize(options: UseMapResizeOptions = {}): UseMapResizeReturn {
  const {
    storageKey = 'tasks_map_height',
    defaultHeight = MAP_HEIGHT_DEFAULT,
    minHeight = MAP_HEIGHT_MIN,
    maxHeightRatio = 0.85,
    step = MAP_HEIGHT_STEP,
  } = options;
  const { height: windowHeight } = useWindowSize();
  const mapHeightStorage = useStorage<number>(storageKey, defaultHeight);
  const mapHeightMax = computed(() => {
    if (!windowHeight.value) return MAP_HEIGHT_MAX_FALLBACK;
    return Math.max(minHeight, Math.round(windowHeight.value * maxHeightRatio));
  });
  const mapHeight = computed({
    get: () => {
      const nextValue =
        typeof mapHeightStorage.value === 'number' ? mapHeightStorage.value : defaultHeight;
      return Math.min(Math.max(nextValue, minHeight), mapHeightMax.value);
    },
    set: (value: number) => {
      mapHeightStorage.value = Math.min(Math.max(value, minHeight), mapHeightMax.value);
    },
  });
  watch(mapHeightMax, (nextMax) => {
    if (mapHeightStorage.value > nextMax) {
      mapHeightStorage.value = nextMax;
    }
  });
  const resizeHandleRef = ref<HTMLElement | null>(null);
  const resizeState = ref<{
    startY: number;
    startHeight: number;
    pointerId: number;
  } | null>(null);
  const savedUserSelect = ref('');
  const isResizing = computed(() => resizeState.value !== null);
  const onResizeMove = (event: PointerEvent) => {
    const state = resizeState.value;
    if (!state) return;
    if (state.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.startY;
    mapHeight.value = Math.round(state.startHeight + delta);
  };
  const stopResize = (event?: PointerEvent) => {
    const state = resizeState.value;
    if (!state) return;
    if (event && state.pointerId !== event.pointerId) return;
    const pointerId = state.pointerId;
    const handle = resizeHandleRef.value;
    resizeState.value = null;
    if (handle?.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    document.body.style.userSelect = savedUserSelect.value;
    savedUserSelect.value = '';
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointercancel', stopResize);
    handle?.removeEventListener('lostpointercapture', stopResize);
  };
  const startResize = (event: PointerEvent) => {
    if (event.button !== 0 || resizeState.value) return;
    const handle = resizeHandleRef.value;
    if (!handle) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    resizeState.value = {
      startY: event.clientY,
      startHeight: mapHeight.value,
      pointerId: event.pointerId,
    };
    savedUserSelect.value = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    handle?.addEventListener?.('lostpointercapture', stopResize);
  };
  const onResizeKeydown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp') {
      mapHeight.value = mapHeight.value - step;
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      mapHeight.value = mapHeight.value + step;
      event.preventDefault();
    } else if (event.key === 'Home') {
      mapHeight.value = minHeight;
      event.preventDefault();
    } else if (event.key === 'End') {
      mapHeight.value = mapHeightMax.value;
      event.preventDefault();
    }
  };
  onScopeDispose(() => {
    stopResize();
  });
  return {
    mapHeight,
    mapHeightMax,
    mapHeightMin: minHeight,
    resizeHandleRef,
    isResizing,
    startResize,
    stopResize,
    onResizeKeydown,
  };
}
