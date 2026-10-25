interface UseOverlayFocusTrapOptions {
  containerRef: { value: HTMLElement | null };
  isOverlayMode: { readonly value: boolean };
}
const OVERLAY_FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function useOverlayFocusTrap({ containerRef, isOverlayMode }: UseOverlayFocusTrapOptions): {
  restoreTriggerFocus: () => void;
  trapFocus: (event: KeyboardEvent) => void;
} {
  const triggerElement = ref<HTMLElement | null>(null);
  const getFocusableElements = (): HTMLElement[] => {
    const container = containerRef.value;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(OVERLAY_FOCUSABLE_SELECTOR)).filter(
      (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1
    );
  };
  const focusContainer = async () => {
    await nextTick();
    containerRef.value?.focus({ preventScroll: true });
  };
  const storeTriggerElement = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !containerRef.value?.contains(activeElement)) {
      triggerElement.value = activeElement;
    }
  };
  const restoreTriggerFocus = () => {
    const trigger = triggerElement.value;
    if (!trigger || !document.contains(trigger)) return;
    trigger.focus({ preventScroll: true });
  };
  const trapFocus = (event: KeyboardEvent) => {
    if (!isOverlayMode.value || event.key !== 'Tab') return;
    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      containerRef.value?.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const activeElement = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (activeElement === first || activeElement === containerRef.value) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
      return;
    }
    if (activeElement === last || activeElement === containerRef.value) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  onMounted(() => {
    storeTriggerElement();
    if (!isOverlayMode.value) return;
    void focusContainer();
  });
  watch(
    () => isOverlayMode.value,
    (isOverlay, wasOverlay) => {
      if (!isOverlay || wasOverlay) return;
      storeTriggerElement();
      void focusContainer();
    }
  );
  return {
    restoreTriggerFocus,
    trapFocus,
  };
}
