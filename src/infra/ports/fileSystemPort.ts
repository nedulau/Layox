import type { FileSystemFileHandleExt, Project } from '../../types';

export interface OpenProjectDialogResult {
  file: File;
  handle: FileSystemFileHandleExt | null;
  filePath?: string;
}

export interface FileSystemPort {
  supportsNativePicker(): boolean;
  openProjectDialog(): Promise<OpenProjectDialogResult | null>;
  openProjectFromPath(filePath: string): Promise<OpenProjectDialogResult | null>;
  saveProject(
    project: Project,
    assetBlobs: Record<string, Blob>,
    existingHandle: FileSystemFileHandleExt | null,
  ): Promise<FileSystemFileHandleExt | null>;
  saveProjectAs(
    project: Project,
    assetBlobs: Record<string, Blob>,
  ): Promise<FileSystemFileHandleExt | null>;
}
