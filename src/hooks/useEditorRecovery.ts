import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { removeStoredValue } from '../infra/storage';
import useProjectStore from '../store/useProjectStore';
import {
  recoveryRepository,
  type RecoverySummary,
} from '../utils/recoveryRepository';
import { useAutoSave } from './useAutoSave';

interface EditorRecoveryOptions {
  projectId: string;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
}

interface EditorRecoveryState {
  recoveryPoints: RecoverySummary[];
  recoveryError: string | null;
  restoreRecoveryPoint: (point: RecoverySummary) => Promise<boolean>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Coordinates recovery snapshots, auto-save and restoring editor state. */
export function useEditorRecovery({
  projectId,
  autoSaveEnabled,
  autoSaveInterval,
}: EditorRecoveryOptions): EditorRecoveryState {
  const [recoveryPoints, setRecoveryPoints] = useState<RecoverySummary[]>([]);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const refreshRecoveryPoints = useCallback(async () => {
    try {
      setRecoveryPoints(await recoveryRepository.list(projectId));
      setRecoveryError(null);
    } catch (error) {
      setRecoveryError(getErrorMessage(error));
    }
  }, [projectId]);

  useEffect(() => {
    removeStoredValue('layox_autoSaveTimeline');
    let active = true;
    void recoveryRepository.list(projectId)
      .then((points) => {
        if (!active) return;
        setRecoveryPoints(points);
        setRecoveryError(null);
      })
      .catch((error) => {
        if (active) setRecoveryError(getErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const createRecoveryPoint = useCallback(async () => {
    const state = useProjectStore.getState();
    const projectCopy = structuredClone(state.project);
    await recoveryRepository.save({
      id: uuidv4(),
      projectId: projectCopy.meta.id,
      createdAt: Date.now(),
      pageIndex: state.currentPageIndex,
      pageCount: projectCopy.pages.length,
      projectName: projectCopy.meta.name,
      project: projectCopy,
    }, state.assetBlobs);
    await refreshRecoveryPoints();
  }, [refreshRecoveryPoints]);

  const handleAutoSaveSuccess = useCallback(() => setRecoveryError(null), []);
  const handleAutoSaveError = useCallback((error: unknown) => {
    setRecoveryError(getErrorMessage(error));
  }, []);
  useAutoSave({
    enabled: autoSaveEnabled,
    intervalSeconds: autoSaveInterval,
    createRecoveryPoint,
    onSuccess: handleAutoSaveSuccess,
    onError: handleAutoSaveError,
  });

  const restoreRecoveryPoint = useCallback(async (point: RecoverySummary) => {
    try {
      const recovered = await recoveryRepository.restore(point.id);
      const state = useProjectStore.getState();
      state.snapshot();
      state.restoreRecoveredProject(recovered.project, recovered.assetBlobs, recovered.pageIndex);
      setRecoveryError(null);
      return true;
    } catch (error) {
      setRecoveryError(getErrorMessage(error));
      return false;
    }
  }, []);

  return {
    recoveryPoints,
    recoveryError,
    restoreRecoveryPoint,
  };
}
