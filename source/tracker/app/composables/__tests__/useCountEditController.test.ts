import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useCountEditController } from '@/composables/useCountEditController';
describe('useCountEditController', () => {
  const mockOnUpdate = vi.fn((_value: number) => {});
  beforeEach(() => {
    mockOnUpdate.mockClear();
  });
  it('initializes with isEditing false', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    expect(controller.isEditing.value).toBe(false);
  });
  it('startEdit sets isEditing true and sets editValue to current', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.startEdit();
    expect(controller.isEditing.value).toBe(true);
    expect(controller.editValue.value).toBe(5);
  });
  it('commitEdit clamps value between min and max', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      min: 2,
      onUpdate: mockOnUpdate,
    });
    controller.startEdit();
    controller.editValue.value = 15;
    controller.commitEdit();
    expect(mockOnUpdate).toHaveBeenCalledWith(10);
    expect(controller.isEditing.value).toBe(false);
  });
  it('commitEdit clamps value to min when below', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      min: 2,
      onUpdate: mockOnUpdate,
    });
    controller.startEdit();
    controller.editValue.value = 0;
    controller.commitEdit();
    expect(mockOnUpdate).toHaveBeenCalledWith(2);
  });
  it('commitEdit uses 0 as default min', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.startEdit();
    controller.editValue.value = -5;
    controller.commitEdit();
    expect(mockOnUpdate).toHaveBeenCalledWith(0);
  });
  it('cancelEdit sets isEditing false without calling onUpdate', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.startEdit();
    controller.cancelEdit();
    expect(controller.isEditing.value).toBe(false);
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
  it('increase increments by 1 up to max', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.increase();
    expect(mockOnUpdate).toHaveBeenCalledWith(6);
  });
  it('increase does nothing when current >= max', () => {
    const controller = useCountEditController({
      current: 10,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.increase();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
  it('decrease decrements by 1 down to min', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.decrease();
    expect(mockOnUpdate).toHaveBeenCalledWith(4);
  });
  it('decrease does nothing when current <= min', () => {
    const controller = useCountEditController({
      current: 0,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.decrease();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
  it('canIncrease is false when current >= max', () => {
    const controller = useCountEditController({
      current: 10,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    expect(controller.canIncrease.value).toBe(false);
  });
  it('canDecrease is false when current <= min', () => {
    const controller = useCountEditController({
      current: 2,
      max: 10,
      min: 2,
      onUpdate: mockOnUpdate,
    });
    expect(controller.canDecrease.value).toBe(false);
  });
  it('updates editValue when current value changes externally during edit', async () => {
    const current = ref(5);
    const onExternalChange = vi.fn();
    const controller = useCountEditController({
      current: () => current.value,
      max: 10,
      onUpdate: mockOnUpdate,
      onExternalChange,
    });
    controller.startEdit();
    controller.editValue.value = 4;
    current.value = 6;
    await nextTick();
    expect(controller.isEditing.value).toBe(true);
    expect(controller.editValue.value).toBe(6);
    expect(onExternalChange).toHaveBeenCalledWith(6, 5);
  });
  it('cancels editing when externalChangeBehavior is cancel', async () => {
    const current = ref(5);
    const controller = useCountEditController({
      current: () => current.value,
      max: 10,
      onUpdate: mockOnUpdate,
      externalChangeBehavior: 'cancel',
    });
    controller.startEdit();
    current.value = 6;
    await nextTick();
    expect(controller.isEditing.value).toBe(false);
  });
  it('works with ref values for current, max, and min', () => {
    const current = ref(5);
    const max = ref(10);
    const min = ref(1);
    const controller = useCountEditController({
      current,
      max,
      min,
      onUpdate: mockOnUpdate,
    });
    expect(controller.canIncrease.value).toBe(true);
    expect(controller.canDecrease.value).toBe(true);
    controller.increase();
    expect(mockOnUpdate).toHaveBeenCalledWith(6);
  });
  it('floors decimal values on commitEdit', () => {
    const controller = useCountEditController({
      current: 5,
      max: 10,
      onUpdate: mockOnUpdate,
    });
    controller.startEdit();
    controller.editValue.value = 7.9;
    controller.commitEdit();
    expect(mockOnUpdate).toHaveBeenCalledWith(7);
  });
});
