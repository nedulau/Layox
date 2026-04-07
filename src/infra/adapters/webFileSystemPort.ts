import { saveProject, saveProjectAs, showOpenDialog } from '../../utils/fileIO';
import type { FileSystemPort } from '../ports/fileSystemPort';

export function createWebFileSystemPort(): FileSystemPort {
  return {
    supportsNativePicker(): boolean {
      return 'showOpenFilePicker' in globalThis;
    },
    async openProjectDialog() {
      const result = await showOpenDialog();
      if (!result) return null;
      return {
        file: result.file,
        handle: result.handle,
      };
    },
    async saveProject(project, assetBlobs, existingHandle) {
      return saveProject(project, assetBlobs, existingHandle);
    },
    async saveProjectAs(project, assetBlobs) {
      return saveProjectAs(project, assetBlobs);
    },
  };
}
