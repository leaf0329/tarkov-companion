<template>
  <div v-if="state" data-testid="companion-toolbar" class="bg-surface-900 border-surface-700 flex flex-wrap items-center gap-2 border-b px-3 py-2 font-sans text-xs [-webkit-app-region:no-drag]" :class="{ 'sticky top-0 z-2000': overlay }">
    <span data-testid="companion-drag-handle" class="text-primary-400 mr-2 flex min-h-7 items-center font-semibold" :class="{ 'cursor-move select-none [-webkit-app-region:drag]': overlay }">leaf0329</span>
    <template v-if="!overlay">
      <NuxtLink to="/companion-map" class="hover:text-primary-400">{{ t('companion.map') }}</NuxtLink>
      <NuxtLink to="/tasks" class="hover:text-primary-400">{{ t('companion.tasks') }}</NuxtLink>
      <NuxtLink to="/companion-events" class="hover:text-primary-400">{{ t('companion.event_guides') }}</NuxtLink>
      <NuxtLink to="/companion-settings" class="hover:text-primary-400">{{ t('companion.settings') }}</NuxtLink>
      <UButton size="xs" color="neutral" variant="outline" @click="windowBridge?.overlay()">{{ t('companion.overlay') }} · {{ state.settings.hotkey }}</UButton>
    </template>
    <UButton data-testid="companion-capture-toggle" size="xs" :color="state.settings.autoScreenshot ? 'primary' : 'neutral'" :loading="saving === 'autoScreenshot'" variant="outline" @click="toggleSetting('autoScreenshot')">{{ t('companion.capture') }}：{{ state.settings.autoScreenshot ? state.settings.interval + 's' : t('companion.off') }}</UButton>
    <UButton data-testid="companion-follow-toggle" size="xs" :color="state.settings.follow ? 'primary' : 'neutral'" :loading="saving === 'follow'" variant="outline" @click="toggleSetting('follow')">{{ t('companion.follow') }}：{{ state.settings.follow ? t('companion.on') : t('companion.off') }}</UButton>
    <UButton data-testid="companion-fullscreen-toggle" size="xs" color="neutral" variant="outline" @click="windowBridge?.fullscreen()">{{ t('companion.fullscreen') }}</UButton>
    <span v-if="!overlay" class="text-surface-400 ml-auto">{{ state.runtime.ready ? t('companion.connected') : t('companion.connecting') }}</span>
    <span v-if="state.runtime.hotkeyError" class="text-amber-300">{{ state.runtime.hotkeyError }}</span>
    <UButton v-if="overlay" size="xs" color="neutral" variant="ghost" class="ml-auto" @click="windowBridge?.overlay()">×</UButton>
  </div>
</template>
<script setup lang="ts">
  import type { CompanionSnapshot } from '@/types/companion';
  const { t } = useI18n();
  const state = useState<CompanionSnapshot | null>('companion');
  const route = useRoute();
  const overlay = computed(() => route.query.overlay === '1');
  const windowBridge = window.companion;
  const saving = ref<'autoScreenshot' | 'follow' | null>(null);
  const toast = useToast();
  const toggleSetting = async (key: 'autoScreenshot' | 'follow'): Promise<void> => {
    if (saving.value || !windowBridge) return;
    saving.value = key;
    try {
      const next = await windowBridge.saveSettings({ [key]: !state.value?.settings[key] });
      state.value = { ...state.value!, settings: next.settings };
    } catch (error) {
      toast.add({ title: t('companion.save_failed'), description: String(error), color: 'error' });
    } finally {
      saving.value = null;
    }
  };
</script>
