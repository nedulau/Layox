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
        location: { kind: 'web-handle', handle: result.handle },
      };
    },
    async openProjectFromPath() {
      return null;
    },
    async saveProject(project, assetBlobs, location) {
      return saveProject(
        project,
        assetBlobs,
        location?.kind === 'web-handle' ? location.handle : null,
      );
    },
    async saveProjectAs(project, assetBlobs) {
      return saveProjectAs(project, assetBlobs);
    },
  };
}
