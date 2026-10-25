import type { Ref } from '#imports';
export type PrereqType = 'station' | 'skill' | 'trader';
export interface UsePrereqModalOptions {
  onConfirm: (key: PrereqType) => void;
  setPreference: (key: PrereqType, value: boolean) => void;
}
export interface UsePrereqModalReturn {
  showPrereqConfirm: Ref<boolean>;
  pendingPrereqToggle: Ref<PrereqType | null>;
  handlePrereqToggle: (key: PrereqType, value: boolean) => void;
  cancelPrereqToggle: () => void;
  confirmPrereqToggle: () => void;
}
export function usePrereqModal({
  onConfirm,
  setPreference,
}: UsePrereqModalOptions): UsePrereqModalReturn {
  const showPrereqConfirm = ref(false);
  const pendingPrereqToggle = ref<PrereqType | null>(null);
  const handlePrereqToggle = (key: PrereqType, value: boolean) => {
    if (!value) {
      setPreference(key, false);
      return;
    }
    pendingPrereqToggle.value = key;
    showPrereqConfirm.value = true;
  };
  const cancelPrereqToggle = () => {
    showPrereqConfirm.value = false;
    pendingPrereqToggle.value = null;
  };
  const confirmPrereqToggle = () => {
    if (!pendingPrereqToggle.value) {
      showPrereqConfirm.value = false;
      return;
    }
    onConfirm(pendingPrereqToggle.value);
    showPrereqConfirm.value = false;
    pendingPrereqToggle.value = null;
  };
  return {
    showPrereqConfirm,
    pendingPrereqToggle,
    handlePrereqToggle,
    cancelPrereqToggle,
    confirmPrereqToggle,
  };
}
