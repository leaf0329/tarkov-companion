<template>
  <div class="bg-surface-950 min-h-screen font-sans">
    <CompanionToolbar />
    <form v-if="draft" class="mx-auto max-w-3xl space-y-5 p-8" @submit.prevent="save">
      <h1 class="text-xl font-semibold">{{ t('companion.settings') }}</h1>
      <div v-for="field in directories" :key="field.key">
        <label class="mb-2 block text-sm">{{ t(field.label) }}</label>
        <div class="flex gap-2"><input v-model="draft[field.key]" class="bg-surface-800 border-surface-700 min-w-0 flex-1 rounded border p-2"><UButton color="neutral" @click="choose(field.key)">{{ t('companion.choose') }}</UButton></div>
      </div>
      <label class="flex items-center gap-3"><input v-model="draft.autoScreenshot" type="checkbox">{{ t('companion.capture') }} · Insert<input v-model.number="draft.interval" type="number" min="1" max="300" class="bg-surface-800 w-20 rounded p-2">{{ t('companion.seconds') }}</label>
      <label class="flex items-center gap-3"><input v-model="draft.cleanupScreenshots" type="checkbox">{{ t('companion.cleanup') }}</label>
      <label class="flex items-center gap-3">{{ t('companion.hotkey') }}<select v-model="draft.hotkey" class="bg-surface-800 rounded p-2"><option v-for="n in 11" :key="n">F{{ n }}</option></select></label>
      <label class="flex items-center gap-3">{{ t('companion.opacity') }}<input v-model.number="draft.opacity" type="range" min="25" max="100">{{ draft.opacity }}%</label>
      <p class="text-surface-400 text-sm">{{ state?.runtime.error || state?.runtime.capture?.message }}</p>
      <p v-if="message" class="text-primary-400">{{ message }}</p>
      <UButton type="submit" :disabled="saving">{{ t('companion.save_all') }}</UButton>
    </form>
  </div>
</template>
<script setup lang="ts">
  import { createCompanionSettingsDraft } from '@/utils/companionSettings';
  import type { CompanionSnapshot } from '@/types/companion';
  import type { CompanionSettingsDraft } from '@/utils/companionSettings';
  definePageMeta({ layout: false });
  const { t } = useI18n();
  const state = useState<CompanionSnapshot | null>('companion');
  const draft = ref<CompanionSettingsDraft | null>(null);
  const message = ref('');
  const saving = ref(false);
  const directories = [{ key: 'logsPath' as const, label: 'companion.logs' }, { key: 'screenshotsPath' as const, label: 'companion.screenshots' }];
  watch(state, (value) => { if (value && !draft.value) draft.value = createCompanionSettingsDraft(value.settings); }, { immediate: true });
  const choose = async (kind: 'logsPath' | 'screenshotsPath') => { const value = await window.companion?.chooseDirectory(kind); if (value && draft.value) draft.value[kind] = value; };
  const save = async () => {
    if (!draft.value) return;
    saving.value = true;
    try { await window.companion?.saveSettings(createCompanionSettingsDraft(draft.value)); message.value = t('companion.saved'); }
    catch (error) { message.value = String(error); }
    finally { saving.value = false; }
  };
</script>
