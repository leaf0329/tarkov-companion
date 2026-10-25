<template>
  <aside
    ref="panelRef"
    tabindex="-1"
    :role="isOverlayMode ? 'dialog' : 'complementary'"
    :aria-modal="isOverlayMode ? 'true' : undefined"
    :aria-labelledby="titleId"
    class="flex flex-col overflow-hidden backdrop-blur-sm"
    :class="
      isOverlayMode
        ? 'bg-surface-900/96 fixed right-3 bottom-3 left-3 z-40 max-h-[70vh] rounded-[28px] border border-white/10 shadow-2xl sm:top-24 sm:right-4 sm:bottom-4 sm:left-auto sm:max-h-[calc(100vh-7rem)] sm:w-[24rem]'
        : 'bg-surface-900/98 sticky top-6 h-[calc(100vh-3rem)] w-full rounded-[28px] border border-white/10 shadow-2xl'
    "
    @keydown="handleKeydown"
  >
    <div class="border-surface-700/60 border-b px-5 py-4 sm:px-5 sm:py-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div
            :id="titleId"
            class="text-surface-50 text-base font-semibold tracking-[0.04em] sm:text-lg"
          >
            {{ content.title }}
          </div>
          <p class="text-surface-300 mt-2 text-[13px] leading-6 sm:text-sm sm:leading-6">
            {{ content.summary }}
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-mdi-close"
          :aria-label="closeLabel"
          @click="handleClose"
        />
      </div>
    </div>
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-4 sm:py-4">
      <div
        v-for="section in content.sections"
        :key="section.title"
        class="bg-surface-950/55 border-surface-700/60 rounded-[24px] border p-4 sm:p-4"
      >
        <div
          class="text-surface-50 text-[11px] font-semibold tracking-[0.18em] uppercase sm:text-xs"
        >
          {{ section.title }}
        </div>
        <p class="text-surface-300 mt-2 text-[13px] leading-6 sm:text-sm sm:leading-6">
          {{ section.description }}
        </p>
        <ul v-if="section.bullets?.length" class="mt-3 space-y-2.5">
          <li
            v-for="bullet in section.bullets"
            :key="bullet"
            class="text-surface-200 flex items-start gap-2.5 text-[13px] leading-6 sm:text-sm sm:leading-6"
          >
            <UIcon
              name="i-mdi-check-circle-outline"
              class="text-primary-400 mt-1 h-4 w-4 shrink-0"
            />
            <span>{{ bullet }}</span>
          </li>
        </ul>
      </div>
    </div>
    <div class="border-surface-700/60 bg-surface-900/98 border-t px-4 py-3 sm:px-4 sm:py-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <UButton
          v-for="action in content.actions"
          :key="action.label"
          :color="action.color ?? 'primary'"
          :variant="action.variant ?? 'soft'"
          :icon="action.icon"
          size="sm"
          class="w-full justify-center sm:w-auto"
          @click="handleAction(action.to)"
        >
          {{ action.label }}
        </UButton>
      </div>
    </div>
  </aside>
</template>
<script setup lang="ts">
  import type { PageHelpKey, PageHelpRoute } from '@/composables/usePageHelpContent';
  interface Props {
    mode?: 'overlay' | 'docked';
    pageKey: PageHelpKey;
  }
  const props = withDefaults(defineProps<Props>(), {
    mode: 'overlay',
  });
  const { t } = useI18n({ useScope: 'global' });
  const { getPageHelpContent } = usePageHelpContent();
  const { close } = usePageHelpState(props.pageKey);
  const panelRef = ref<HTMLElement | null>(null);
  const titleId = `page-help-title-${useId()}`;
  const content = computed(() => getPageHelpContent(props.pageKey));
  const closeLabel = computed(() => t('common.close'));
  const isOverlayMode = computed(() => props.mode === 'overlay');
  const { trapFocus } = useOverlayFocusTrap({
    containerRef: panelRef,
    isOverlayMode,
  });
  const handleClose = () => {
    close();
  };
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
      return;
    }
    trapFocus(event);
  };
  const handleAction = async (to: PageHelpRoute) => {
    close({ restoreFocus: false });
    await navigateTo(to);
  };
</script>
