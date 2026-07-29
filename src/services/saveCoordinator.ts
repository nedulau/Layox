import type { FileSystemPort, ProjectLocation, SaveOutcome } from '../infra/ports/fileSystemPort';
import type { Project } from '../types';

export interface SaveCoordinatorState {
  project: Project;
  assetBlobs: Record<string, Blob>;
  projectLocation: ProjectLocation | null;
  revision: number;
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
  let activeSave: Promise<SaveOutcome> | null = null;
  let activeSaveIsSaveAs = false;
  let queuedSaveAs: Promise<SaveOutcome> | null = null;

  const startSave = (saveAs: boolean): Promise<SaveOutcome> => {
    activeSaveIsSaveAs = saveAs;
    const task = (async () => {
      const stateAtStart = getState();
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
        updateSaveState({
          isSaving: false,
          saveError: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        activeSave = null;
        activeSaveIsSaveAs = false;
      }
    })();
    activeSave = task;
    return task;
  };

  return (saveAs: boolean): Promise<SaveOutcome> => {
    if (!activeSave) return startSave(saveAs);

    // Repeated in-place saves can share the current write. Save As is a
    // distinct user request, though, and must run after an in-place save.
    if (!saveAs || activeSaveIsSaveAs) return activeSave;
    if (!queuedSaveAs) {
      const currentSave = activeSave;
      queuedSaveAs = currentSave
        .then(
          () => startSave(true),
          () => startSave(true),
        )
        .finally(() => {
          queuedSaveAs = null;
        });
    }
    return queuedSaveAs;
  };
}
