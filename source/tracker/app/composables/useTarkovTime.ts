import { useNow } from '@vueuse/core';
/**
 * Calculates Escape from Tarkov in-game time.
 *
 * Logic:
 * - Time flows 7x faster than real life (TARKOV_RATE).
 * - The base calculation is: (RealTimestamp * 7) + FixedOffset.
 * - This result is wrapped to a 24-hour cycle using modulo.
 * - The "Moscow Offset" aligns the calculated time with the game's servers.
 * - The secondary time represents the alternate in-game timezone (exactly 12 hours
 *   offset) the game uses to show the opposite cycle or a different map/region.
 * - Secondary time = primary time ± 12 hours; use it for dual-map time displays
 *   (e.g., showing day/night for another server/map) or syncing events across maps.
 */
const ONE_HOUR = 60 * 60 * 1000;
const TARKOV_RATE = 7;
const MOSCOW_OFFSET = 3 * ONE_HOUR;
const SECONDARY_OFFSET = 12;
const pad = (value: number) => value.toString().padStart(2, '0');
export function useTarkovTime(intervalMs = 1000) {
  const now = useNow({ interval: intervalMs });
  const tarkovTime = computed(() => {
    const tarkovMs = (now.value.getTime() * TARKOV_RATE + MOSCOW_OFFSET) % (24 * ONE_HOUR);
    const tarkovDate = new Date(tarkovMs);
    const hour = tarkovDate.getUTCHours();
    const minute = tarkovDate.getUTCMinutes();
    const second = tarkovDate.getUTCSeconds();
    const secondaryHour = (hour + SECONDARY_OFFSET) % 24;
    return `${pad(hour)}:${pad(minute)}:${pad(second)} / ${pad(secondaryHour)}:${pad(minute)}:${pad(second)}`;
  });
  return { tarkovTime };
}
