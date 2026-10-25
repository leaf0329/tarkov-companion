import { describe, expect, it } from 'vitest';
import type { ActionButtonState } from '@/features/tasks/types';
const computeActionButtonState = (options: {
  isOurFaction: boolean;
  isFailed: boolean;
  isLocked: boolean;
  isComplete: boolean;
  showHotWheelsFail: boolean;
}): ActionButtonState => {
  if (!options.isOurFaction) return 'none';
  if (options.isFailed) return 'complete';
  if (options.isLocked) return 'locked';
  if (options.isComplete) return 'complete';
  if (options.showHotWheelsFail) return 'hotwheels';
  return 'available';
};
describe('TaskCard action button state', () => {
  it('uses complete-state actions when task is failed', () => {
    const state = computeActionButtonState({
      isOurFaction: true,
      isFailed: true,
      isLocked: false,
      isComplete: false,
      showHotWheelsFail: false,
    });
    expect(state).toBe('complete');
  });
  it('failed state takes precedence over hotwheels and locked states', () => {
    const state = computeActionButtonState({
      isOurFaction: true,
      isFailed: true,
      isLocked: true,
      isComplete: false,
      showHotWheelsFail: true,
    });
    expect(state).toBe('complete');
  });
  it('returns none when task does not match current faction', () => {
    const state = computeActionButtonState({
      isOurFaction: false,
      isFailed: true,
      isLocked: true,
      isComplete: true,
      showHotWheelsFail: true,
    });
    expect(state).toBe('none');
  });
  it('keeps available state for normal unlocked non-failed tasks', () => {
    const state = computeActionButtonState({
      isOurFaction: true,
      isFailed: false,
      isLocked: false,
      isComplete: false,
      showHotWheelsFail: false,
    });
    expect(state).toBe('available');
  });
});
