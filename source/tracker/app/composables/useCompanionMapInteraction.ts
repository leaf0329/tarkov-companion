import { useCompanionWindowReset } from '@/composables/useCompanionWindowReset';
import type L from 'leaflet';
export function useCompanionMapInteraction(instance: Ref<L.Map | null>, resetControls: () => void): void {
  if (!(import.meta.client && window.companion)) return;
  let gestureActive = false;
  const startDrag = () => { gestureActive = true; };
  const endDrag = () => { gestureActive = false; };
  const isMapTarget = (target: EventTarget | null) => Boolean(instance.value?.getContainer().contains(target as Node));
  const reset = () => {
    const map = instance.value;
    if (map?.dragging.enabled()) {
      // Leaflet needs disable/enable to release its document listeners and global drag lock.
      map.dragging.disable();
      map.dragging.enable();
    }
    map?.stop();
    gestureActive = false;
    resetControls();
  };
  const onPointerDown = (event: PointerEvent) => {
    if (gestureActive) reset();
    gestureActive = event.button === 0 && isMapTarget(event.target);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (gestureActive && event.buttons === 0) reset();
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) gestureActive = false;
  };
  const onPointerCancel = () => { if (gestureActive) reset(); };
  const onVisibilityChange = () => { if (document.hidden) reset(); };
  const events = { pointerdown: onPointerDown, pointermove: onPointerMove, pointerup: onPointerUp, pointercancel: onPointerCancel, lostpointercapture: onPointerCancel };
  const bindDragEvents = (map: L.Map | null, bind: 'on' | 'off') => {
    map?.[bind]('dragstart', startDrag);
    map?.[bind]('dragend', endDrag);
  };
  watch(instance, (next, previous) => {
    bindDragEvents(previous ?? null, 'off');
    gestureActive = false;
    bindDragEvents(next, 'on');
  }, { immediate: true });
  useCompanionWindowReset(reset);
  onMounted(() => {
    if (!window.companion) return;
    for (const [event, handler] of Object.entries(events)) document.addEventListener(event, handler as EventListener, true);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
  });
  onScopeDispose(() => {
    bindDragEvents(instance.value, 'off');
    for (const [event, handler] of Object.entries(events)) document.removeEventListener(event, handler as EventListener, true);
    window.removeEventListener('blur', reset);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
}
