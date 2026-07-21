import { useEffect, useRef } from 'react';
import useProjectStore from '../store/useProjectStore';

export interface AutoSaveOptions {
  enabled: boolean;
  intervalSeconds: number;
  createRecoveryPoint: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
}

/** Coordinates recovery snapshots and file updates without opening save dialogs. */
export function useAutoSave({
  enabled,
  intervalSeconds,
  createRecoveryPoint,
  onSuccess,
  onError,
}: AutoSaveOptions): void {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || intervalSeconds <= 0) return;
    const intervalId = window.setInterval(() => {
      const state = useProjectStore.getState();
      if (!state.isDirty || state.isSaving || runningRef.current) return;
      runningRef.current = true;
      void (async () => {
        try {
          await createRecoveryPoint();
          const latestState = useProjectStore.getState();
          if (latestState.projectLocation && latestState.isDirty) {
            await latestState.saveCurrentProject();
          }
          onSuccess();
        } catch (error) {
          onError(error);
        } finally {
          runningRef.current = false;
        }
      })();
    }, intervalSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [createRecoveryPoint, enabled, intervalSeconds, onError, onSuccess]);
}
