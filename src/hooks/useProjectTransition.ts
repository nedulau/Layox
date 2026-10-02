import { useCallback, useState } from 'react';
import useProjectStore from '../store/useProjectStore';

interface PendingTransition {
  projectSession: number;
  action: () => void;
}

/** Protects replacing or leaving a project through every editor entry point. */
export function useProjectTransition() {
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const requestTransition = useCallback((action: () => void) => {
    const state = useProjectStore.getState();
    setSaveError(null);
    if (state.isDirty) setPending({ projectSession: state.projectSession, action });
    else {
      setPending(null);
      action();
    }
  }, []);

  const cancelTransition = useCallback(() => {
    if (!isSaving) {
      setPending(null);
      setSaveError(null);
    }
  }, [isSaving]);

  const discardAndTransition = useCallback(() => {
    if (!pending || isSaving) return;
    setPending(null);
    setSaveError(null);
    if (useProjectStore.getState().projectSession === pending.projectSession) pending.action();
  }, [isSaving, pending]);

  const saveAndTransition = useCallback(async () => {
    if (!pending || isSaving) return;
    const state = useProjectStore.getState();
    if (state.projectSession !== pending.projectSession) {
      setPending(null);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const outcome = await state.saveCurrentProject();
      const latest = useProjectStore.getState();
      if (latest.projectSession !== pending.projectSession) {
        setPending(null);
      } else if (outcome.status !== 'cancelled' && !latest.isDirty) {
        setPending(null);
        pending.action();
      }
    } catch (error) {
      if (useProjectStore.getState().projectSession === pending.projectSession) {
        setSaveError(error instanceof Error ? error.message : String(error));
      } else {
        setPending(null);
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, pending]);

  return {
    isPending: pending !== null,
    isSaving,
    saveError,
    requestTransition,
    cancelTransition,
    discardAndTransition,
    saveAndTransition,
  };
}
