import type { FileSystemPort, ProjectLocation, SaveOutcome } from '../infra/ports/fileSystemPort';
import type { Project } from '../types';

export interface SaveCoordinatorState {
  project: Project;
  assetBlobs: Record<string, Blob>;
  projectLocation: ProjectLocation | null;
  revision: number;
  projectSession: number;
}

export interface SaveStatePatch {
  projectLocation?: ProjectLocation | null;
  savedRevision?: number;
  isDirty?: boolean;
  isSaving: boolean;
  saveError?: string | null;
}

export interface SavedProjectDetails {
  projectName: string;
  fileName: string;
  filePath?: string;
}

export function createSaveCoordinator({
  fileSystemPort,
  getState,
  updateSaveState,
  onSavedProject,
}: {
  fileSystemPort: FileSystemPort;
  getState: () => SaveCoordinatorState;
  updateSaveState: (patch: SaveStatePatch) => void;
  onSavedProject: (details: SavedProjectDetails) => void;
}) {
  const activeSaves = new Map<number, Promise<SaveOutcome>>();

  return (saveAs: boolean): Promise<SaveOutcome> => {
    const stateAtStart = getState();
    const sessionAtStart = stateAtStart.projectSession;
    const activeSave = activeSaves.get(sessionAtStart);
    if (activeSave) return activeSave;
    const isCurrentSession = () => getState().projectSession === sessionAtStart;
    const task = (async () => {
      const revisionAtStart = stateAtStart.revision;
      updateSaveState({ isSaving: true, saveError: null });
      try {
        const outcome = saveAs
          ? await fileSystemPort.saveProjectAs(stateAtStart.project, stateAtStart.assetBlobs)
          : await fileSystemPort.saveProject(
              stateAtStart.project,
              stateAtStart.assetBlobs,
              stateAtStart.projectLocation,
            );

        if (!isCurrentSession()) return outcome;
        if (outcome.status === 'cancelled') {
          updateSaveState({ isSaving: false });
          return outcome;
        }

        updateSaveState({
          projectLocation: outcome.status === 'saved' ? outcome.location : null,
          savedRevision: revisionAtStart,
          isDirty: getState().revision !== revisionAtStart,
          isSaving: false,
          saveError: null,
        });

        if (outcome.status === 'saved') {
          const fileName = outcome.location.kind === 'web-handle'
            ? outcome.location.handle.name
            : outcome.location.filePath.split(/[\\/]/).pop() || `${stateAtStart.project.meta.name}.layox`;
          onSavedProject({
            projectName: stateAtStart.project.meta.name,
            fileName,
            filePath: outcome.location.kind === 'native-path' ? outcome.location.filePath : undefined,
          });
        }
        return outcome;
      } catch (error) {
        if (isCurrentSession()) {
          updateSaveState({
            isSaving: false,
            saveError: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    })().finally(() => {
      activeSaves.delete(sessionAtStart);
    });
    activeSaves.set(sessionAtStart, task);
    return task;
  };
}
