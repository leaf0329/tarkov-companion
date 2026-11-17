<template>
  <UModal
    v-model:open="open"
    fullscreen
    :transition="false"
    :title="t('companion.reference_map_title', { name })"
    :description="t('companion.reference_map_hint')"
    :ui="{
      content:
        'fixed inset-0 z-[1200] flex h-dvh w-screen flex-col items-stretch justify-start overflow-hidden bg-surface-950 p-0 pointer-events-auto',
      header: 'relative min-h-0 shrink-0 px-3 py-2 pr-12',
      wrapper: 'w-full max-w-none rounded-none border-0 bg-transparent shadow-none',
      body: 'flex min-h-0 flex-1 flex-col overflow-hidden p-0!',
    }"
  >
    <template #body>
      <div class="flex h-full min-h-0 flex-col">
        <div
          ref="container"
          data-testid="reference-map-view"
          class="bg-surface-950 min-h-0 flex-1"
        />
        <div class="border-surface-700 text-surface-400 border-t px-3 py-1 text-xs">
          {{ definition.credit }}
        </div>
      </div>
    </template>
  </UModal>
</template>
<script setup lang="ts">
  import type { ReferenceMapDefinition } from '@/features/maps/utils/detailedMaps';
  import type L from 'leaflet';
  const props = defineProps<{ definition: ReferenceMapDefinition; name: string }>();
  const open = defineModel<boolean>('open', { default: false });
  const { t } = useI18n();
  const container = ref<HTMLElement | null>(null);
  let owner: L.Map | null = null;
  let observer: ResizeObserver | null = null;
  const clear = () => {
    observer?.disconnect();
    observer = null;
    owner?.remove();
    owner = null;
  };
  watch(
    container,
    async (element) => {
      clear();
      if (!element) return;
      const library = await import('leaflet');
      if (container.value !== element) return;
      const leaflet = library.default || library;
      const bounds: L.LatLngBoundsExpression = [
        [-props.definition.height / 16, 0],
        [0, props.definition.width / 16],
      ];
      owner = leaflet.map(element, {
        crs: leaflet.CRS.Simple,
        minZoom: -3,
        maxZoom: 6,
        zoomAnimation: false,
        attributionControl: false,
      });
      leaflet
        .tileLayer('/companion/reference/' + props.definition.key + '/{z}/{x}/{y}.webp', {
          bounds,
          minZoom: -3,
          minNativeZoom: 0,
          maxNativeZoom: 4,
          maxZoom: 6,
          noWrap: true,
        })
        .addTo(owner);
      owner.fitBounds(bounds);
      observer = new ResizeObserver(() => owner?.invalidateSize({ animate: false }));
      observer.observe(element);
    },
    { flush: 'post' }
  );
  onScopeDispose(clear);
</script>
