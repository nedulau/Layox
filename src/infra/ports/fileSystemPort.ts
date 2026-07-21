import type { FileSystemFileHandleExt, Project } from '../../types';

export interface OpenProjectDialogResult {
  file: File;
  location: ProjectLocation | null;
}

export type ProjectLocation =
  | { kind: 'web-handle'; handle: FileSystemFileHandleExt }
  | { kind: 'native-path'; filePath: string };

export type SaveOutcome =
  | { status: 'saved'; location: ProjectLocation }
  | { status: 'downloaded' }
  | { status: 'cancelled' };

export interface FileSystemPort {
  supportsNativePicker(): boolean;
  openProjectDialog(): Promise<OpenProjectDialogResult | null>;
  openProjectFromPath(filePath: string): Promise<OpenProjectDialogResult | null>;
  saveProject(
    project: Project,
    assetBlobs: Record<string, Blob>,
    location: ProjectLocation | null,
  ): Promise<SaveOutcome>;
  saveProjectAs(
    project: Project,
    assetBlobs: Record<string, Blob>,
  ): Promise<SaveOutcome>;
}
