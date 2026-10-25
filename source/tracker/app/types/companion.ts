import type { UserState } from '@/stores/progressState';
export interface CompanionSettings {
  logsPath: string;
  screenshotsPath: string;
  hotkey: string;
  opacity: number;
  interval: number;
  autoScreenshot: boolean;
  cleanupScreenshots: boolean;
  follow: boolean;
}
export interface CompanionPosition {
  map: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  at: number;
}
export interface CompanionSnapshot {
  settings: CompanionSettings;
  profile: string;
  progressRevision: number;
  progress: Record<string, { status: string; at: number; source: string }>;
  ui: Partial<UserState>;
  runtime: {
    ready: boolean;
    map: string | null;
    mode: string | null;
    raid: string;
    position: CompanionPosition | null;
    error: string | null;
    hotkeyError?: string | null;
    capture?: { message: string };
  };
}
export type CompanionUpdate = Omit<CompanionSnapshot, 'progress' | 'ui'> & Partial<Pick<CompanionSnapshot, 'progress' | 'ui'>>;
export type CompanionWindowResetReason = 'show' | 'hide' | 'minimize' | 'restore' | 'blur' | 'resume';
export interface CompanionBridge {
  getState: () => Promise<CompanionSnapshot>;
  saveProgress: (value: { profile: string; state: UserState }) => Promise<CompanionSnapshot>;
  saveSettings: (value: Partial<CompanionSettings>) => Promise<CompanionSnapshot>;
  chooseDirectory: (kind: string) => Promise<string | null>;
  overlay: () => Promise<void>;
  fullscreen: () => Promise<void>;
  subscribe: (callback: (state: CompanionUpdate) => void) => () => void;
  subscribeWindowReset: (callback: (reason: CompanionWindowResetReason) => void) => () => void;
}
declare global {
  interface Window {
    companion?: CompanionBridge;
  }
}
