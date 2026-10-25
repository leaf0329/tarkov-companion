<template>
  <UTooltip
    v-bind="attrs"
    :text="props.text"
    :kbds="props.kbds"
    :arrow="props.arrow"
    :disabled="props.disabled"
    :content="mergedContent"
  >
    <slot />
    <template v-if="$slots.content" #content="slotProps">
      <slot name="content" v-bind="slotProps" />
    </template>
  </UTooltip>
</template>
<script setup lang="ts">
  defineOptions({ inheritAttrs: false });
  type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
  type TooltipContent = {
    side?: TooltipSide;
    sideOffset?: number;
    collisionPadding?: number;
    [key: string]: unknown;
  };
  const props = withDefaults(
    defineProps<{
      text?: string;
      kbds?: Array<string | undefined>;
      content?: TooltipContent;
      arrow?: boolean;
      disabled?: boolean;
    }>(),
    {
      text: undefined,
      kbds: undefined,
      content: () => ({}),
      arrow: false,
      disabled: false,
    }
  );
  const attrs = useAttrs();
  const mergedContent = computed<TooltipContent>(() => ({
    side: 'top',
    sideOffset: 10,
    collisionPadding: 8,
    ...props.content,
  }));
</script>
