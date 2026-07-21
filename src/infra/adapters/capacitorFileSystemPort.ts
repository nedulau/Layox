import type { Project } from '../../types';
import { createWebFileSystemPort } from './webFileSystemPort';
import type { FileSystemPort } from '../ports/fileSystemPort';
import { createProjectArchiveBlob } from '../../utils/projectArchive';

function getCapacitorBridge() {
  return globalThis.capacitorBridge;
}

function createSuggestedName(project: Project): string {
  return `${project.meta.name.replace(/[^\p{L}\p{N}_\- ]/gu, '_')}.layox`;
}

export function createCapacitorFileSystemPort(): FileSystemPort {
  const webFileSystemFallback = createWebFileSystemPort();

  return {
    supportsNativePicker(): boolean {
      return !!getCapacitorBridge()?.openProject || webFileSystemFallback.supportsNativePicker();
    },
    async openProjectDialog() {
      const bridge = getCapacitorBridge();
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
      const bridge = getCapacitorBridge();
      if (!bridge?.openProjectFromPath) return null;
      const payload = await bridge.openProjectFromPath(filePath);
      if (!payload) return null;

      return {
        file: new File([payload.data], payload.name, { type: 'application/zip' }),
        location: payload.filePath ? { kind: 'native-path', filePath: payload.filePath } : null,
      };
    },
    async saveProject(project, assetBlobs, location) {
      const bridge = getCapacitorBridge();
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
      const bridge = getCapacitorBridge();
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
