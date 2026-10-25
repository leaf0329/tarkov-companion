import { describe, expect, it } from 'vitest';
import { isReactive, reactive } from 'vue';
import { createCompanionSettingsDraft } from '@/utils/companionSettings';
import type { CompanionSettings } from '@/types/companion';
const settings: CompanionSettings = {
  logsPath: 'D:/EFT/Logs',
  screenshotsPath: 'D:/EFT/Screenshots',
  hotkey: 'F11',
  opacity: 85,
  interval: 5,
  autoScreenshot: false,
  cleanupScreenshots: false,
  follow: true,
};
describe('companion settings form', () => {
  it('produces a cloneable payload from reactive settings with nested window bounds', () => {
    const input = reactive({
      ...settings,
      overlayBounds: { x: 12, y: 20, width: 620, height: 570 },
    });
    expect(isReactive(input.overlayBounds)).toBe(true);
    input.interval = 12;
    input.opacity = 60;
    input.autoScreenshot = true;
    input.cleanupScreenshots = true;
    input.logsPath = 'D:/游戏日志/Logs';
    const payload = createCompanionSettingsDraft(input);
    expect(structuredClone(payload)).toEqual({
      logsPath: 'D:/游戏日志/Logs',
      screenshotsPath: settings.screenshotsPath,
      hotkey: 'F11',
      opacity: 60,
      interval: 12,
      autoScreenshot: true,
      cleanupScreenshots: true,
    });
    expect(payload).not.toHaveProperty('overlayBounds');
    expect(payload).not.toHaveProperty('follow');
  });
  it('keeps form edits separate from live settings before saving', () => {
    const input = reactive({ ...settings });
    const draft = reactive(createCompanionSettingsDraft(input));
    draft.hotkey = 'F9';
    draft.autoScreenshot = true;
    draft.opacity = 25;
    expect(input.hotkey).toBe('F11');
    expect(input.autoScreenshot).toBe(false);
    expect(input.opacity).toBe(85);
  });
});
