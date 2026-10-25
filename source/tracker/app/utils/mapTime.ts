export const STATIC_TIME_MAPS: Record<string, string> = {
  '55f2d3fd4bdc2d5f408b4567': '15:28:00 / 03:28:00', // Factory
  '5b0fc42d86f7744a585f9105': '15:28:00 / 03:28:00', // The Lab
};
export function resolveStaticDisplayTime(staticTime: string, tarkovTime: string): string {
  const secondsMatch = /^(\d{1,2}):(\d{2}):(\d{2})/.exec(tarkovTime);
  const currentSeconds = secondsMatch?.[3] ?? '00';
  return staticTime
    .split('/')
    .map((part) => {
      const partMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(part.trim());
      if (!partMatch) return part.trim();
      return `${partMatch[1]}:${partMatch[2]}:${currentSeconds}`;
    })
    .join(' / ');
}
