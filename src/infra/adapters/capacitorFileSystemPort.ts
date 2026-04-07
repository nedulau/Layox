import JSZip from 'jszip';
import type { Project } from '../../types';
import { createWebFileSystemPort } from './webFileSystemPort';
import type { FileSystemPort } from '../ports/fileSystemPort';

function getCapacitorBridge() {
  return globalThis.capacitorBridge;
}

function createSuggestedName(project: Project): string {
  return `${project.meta.name.replace(/[^\p{L}\p{N}_\- ]/gu, '_')}.layox`;
}

async function buildProjectArchiveBlob(project: Project, assetBlobs: Record<string, Blob>): Promise<Blob> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  for (const [path, blob] of Object.entries(assetBlobs)) {
    zip.file(path, blob);
  }
  return zip.generateAsync({ type: 'blob' });
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
        handle: null,
      };
    },
    async saveProject(project, assetBlobs, existingHandle) {
      const bridge = getCapacitorBridge();
      if (!bridge?.saveProject) {
        return webFileSystemFallback.saveProject(project, assetBlobs, existingHandle);
      }

      const archiveBlob = await buildProjectArchiveBlob(project, assetBlobs);
      const payload = {
        name: createSuggestedName(project),
        data: await archiveBlob.arrayBuffer(),
      };

      if (existingHandle && bridge.saveProject) {
        await bridge.saveProject(payload);
        return existingHandle;
      }

      if (bridge.saveProjectAs) {
        await bridge.saveProjectAs(payload);
        return null;
      }

      await bridge.saveProject(payload);
      return null;
    },
    async saveProjectAs(project, assetBlobs) {
      const bridge = getCapacitorBridge();
      if (!bridge?.saveProjectAs && !bridge?.saveProject) {
        return webFileSystemFallback.saveProjectAs(project, assetBlobs);
      }

      const archiveBlob = await buildProjectArchiveBlob(project, assetBlobs);
      const payload = {
        name: createSuggestedName(project),
        data: await archiveBlob.arrayBuffer(),
      };

      if (bridge.saveProjectAs) {
        await bridge.saveProjectAs(payload);
        return null;
      }

      const saveWithOverwrite = bridge.saveProject;
      if (!saveWithOverwrite) return null;
      await saveWithOverwrite(payload);
      return null;
    },
  };
}
