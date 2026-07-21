import type { Project } from '../../types';
import { createWebFileSystemPort } from './webFileSystemPort';
import type { FileSystemPort } from '../ports/fileSystemPort';
import { createProjectArchiveBlob } from '../../utils/projectArchive';

function getElectronBridge() {
  return globalThis.electronBridge;
}

function createSuggestedName(project: Project): string {
  return `${project.meta.name.replace(/[^\p{L}\p{N}_\- ]/gu, '_')}.layox`;
}

export function createElectronFileSystemPort(): FileSystemPort {
  const webFileSystemFallback = createWebFileSystemPort();

  return {
    supportsNativePicker(): boolean {
      return !!getElectronBridge()?.openProject || webFileSystemFallback.supportsNativePicker();
    },
    async openProjectDialog() {
      const bridge = getElectronBridge();
      if (!bridge?.openProject) {
        return webFileSystemFallback.openProjectDialog();
      }

      const payload = await bridge.openProject();
      if (!payload) return null;

      return {
        file: new File([payload.data], payload.name, { type: 'application/zip' }),
        location: payload.filePath ? { kind: 'native-path', filePath: payload.filePath } : null,
      };
    },
    async openProjectFromPath(filePath: string) {
      const bridge = getElectronBridge();
      if (!bridge?.openProjectFromPath) return null;
      const payload = await bridge.openProjectFromPath(filePath);
      if (!payload) return null;

      return {
        file: new File([payload.data], payload.name, { type: 'application/zip' }),
        location: payload.filePath ? { kind: 'native-path', filePath: payload.filePath } : null,
      };
    },
    async saveProject(project, assetBlobs, location) {
      const bridge = getElectronBridge();
      if (!bridge?.saveProject) {
        return webFileSystemFallback.saveProject(project, assetBlobs, location);
      }

      const archiveBlob = await createProjectArchiveBlob(project, assetBlobs);
      const payload = {
        name: createSuggestedName(project),
        data: await archiveBlob.arrayBuffer(),
        targetPath: location?.kind === 'native-path' ? location.filePath : null,
      };
      const result = await bridge.saveProject(payload);
      if (!result) return { status: 'cancelled' };
      return { status: 'saved', location: { kind: 'native-path', filePath: result.filePath } };
    },
    async saveProjectAs(project, assetBlobs) {
      const bridge = getElectronBridge();
      if (!bridge?.saveProjectAs) {
        return webFileSystemFallback.saveProjectAs(project, assetBlobs);
      }

      const archiveBlob = await createProjectArchiveBlob(project, assetBlobs);
      const payload = {
        name: createSuggestedName(project),
        data: await archiveBlob.arrayBuffer(),
      };

      const result = await bridge.saveProjectAs(payload);
      if (!result) return { status: 'cancelled' };
      return { status: 'saved', location: { kind: 'native-path', filePath: result.filePath } };
    },
  };
}
