<template>
  <div class="bg-surface-950 text-surface-100 min-h-screen font-sans">
    <CompanionToolbar />
    <main class="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 class="text-xl font-semibold">{{ guide.title }}</h1>
        <p class="text-surface-400 mt-2 text-sm">{{ t('companion.events_checked', { date: guide.checkedAt }) }}</p>
      </header>
      <p class="border-surface-700 bg-surface-900 rounded-lg border p-4 text-sm leading-relaxed">{{ guide.scope }}</p>
      <article v-for="task in guide.tasks" :key="task.slug" data-testid="event-guide-task" class="border-surface-700 bg-surface-900 rounded-lg border p-4">
        <h2 class="text-primary-300 font-semibold">{{ task.name }}</h2>
        <p class="text-surface-300 mt-1 text-sm">{{ task.trader }} · {{ task.maps }}</p>
        <p v-if="task.prerequisite" class="text-surface-400 mt-2 text-sm">{{ t('companion.events_prerequisite') }}：{{ task.prerequisite }}</p>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li v-for="objective in task.objectives" :key="objective">{{ objective }}</li>
        </ol>
        <p v-for="note in task.notes" :key="note" class="text-surface-300 mt-3 text-sm leading-relaxed">{{ note }}</p>
        <a :href="task.source" target="_blank" rel="noopener noreferrer" class="text-primary-400 mt-3 inline-block text-sm hover:underline">{{ t('companion.events_source') }}</a>
      </article>
    </main>
  </div>
</template>
<script setup lang="ts">
  import guide from '@/data/companionHalloween2026.json';

  definePageMeta({ layout: false });
  const { t } = useI18n();
</script>
