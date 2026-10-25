import type { CompanionSettings } from '@/types/companion';
export type CompanionSettingsDraft = Pick<
  CompanionSettings,
  | 'logsPath'
  | 'screenshotsPath'
  | 'hotkey'
  | 'opacity'
  | 'interval'
  | 'autoScreenshot'
  | 'cleanupScreenshots'
>;
// Window bounds and toolbar follow state are saved independently of this form.
export const createCompanionSettingsDraft = (
  settings: CompanionSettingsDraft
): CompanionSettingsDraft => ({
  logsPath: settings.logsPath,
  screenshotsPath: settings.screenshotsPath,
  hotkey: settings.hotkey,
  opacity: settings.opacity,
  interval: settings.interval,
  autoScreenshot: settings.autoScreenshot,
  cleanupScreenshots: settings.cleanupScreenshots,
});
