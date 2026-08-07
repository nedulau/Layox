import type JSZip from 'jszip';
import type { Project } from '../types';
import {
  collectReferencedAssetPaths,
  MAX_PROJECT_ARCHIVE_ENTRIES,
  MAX_PROJECT_ARCHIVE_BYTES,
  MAX_PROJECT_ASSET_BYTES,
  MAX_PROJECT_COMPRESSION_RATIO,
  MAX_PROJECT_JSON_BYTES,
  MAX_PROJECT_UNCOMPRESSED_BYTES,
  migrateAndValidateProject,
} from '../domain/projectSchema';

type LoadedZipEntry = JSZip.JSZipObject & {
  _data?: {
    compressedSize?: number;
    uncompressedSize?: number;
  };
  unsafeOriginalName?: string;
};

function entrySizes(entry: JSZip.JSZipObject): { compressed: number; uncompressed: number } {
  const metadata = (entry as LoadedZipEntry)._data;
  const compressed = metadata?.compressedSize;
  const uncompressed = metadata?.uncompressedSize;
  if (
    typeof compressed !== 'number' || !Number.isSafeInteger(compressed) || compressed < 0 ||
    typeof uncompressed !== 'number' || !Number.isSafeInteger(uncompressed) || uncompressed < 0
  ) {
    throw new Error(`Invalid .layox file: invalid ZIP metadata for ${entry.name}.`);
  }
  return { compressed, uncompressed };
}

function validateArchiveMetadata(zip: JSZip): void {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_PROJECT_ARCHIVE_ENTRIES) {
    throw new Error('Invalid .layox file: the archive contains too many entries.');
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const { compressed, uncompressed } = entrySizes(entry);

    if (entry.name === 'project.json' && uncompressed > MAX_PROJECT_JSON_BYTES) {
      throw new Error('Invalid .layox file: project.json exceeds 5 MiB.');
    }

    if (!entry.name.startsWith('assets/')) continue;
    const originalName = (entry as LoadedZipEntry).unsafeOriginalName ?? entry.name;
    if (originalName.includes('..') || entry.name.endsWith('/')) {
      throw new Error(`Invalid .layox file: invalid asset path ${originalName}.`);
    }
    if (uncompressed > MAX_PROJECT_ASSET_BYTES) {
      throw new Error(`Invalid .layox file: asset ${entry.name} exceeds 128 MiB.`);
    }
    if (uncompressed > 0 && uncompressed / Math.max(1, compressed) > MAX_PROJECT_COMPRESSION_RATIO) {
      throw new Error(`Invalid .layox file: suspicious compression ratio for ${entry.name}.`);
    }
    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_PROJECT_UNCOMPRESSED_BYTES) {
      throw new Error('Invalid .layox file: uncompressed assets exceed 512 MiB.');
    }
  }
}

export async function createProjectArchiveBlob(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  for (const [path, blob] of Object.entries(assetBlobs)) {
    if (!path.startsWith('assets/') || path.includes('..') || path.endsWith('/')) {
      throw new Error(`Invalid asset path: ${path}.`);
    }
    zip.file(path, blob);
  }
  return zip.generateAsync({ type: 'blob', streamFiles: true });
}

export async function loadProjectArchive(
  file: Blob,
): Promise<{ project: Project; assetBlobs: Record<string, Blob> }> {
  if (file.size > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new Error('The Layox project exceeds the 2 GiB archive limit.');
  }

  const { default: JSZip } = await import('jszip');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Invalid .layox file: the ZIP archive is damaged.');
  }
  validateArchiveMetadata(zip);

  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .layox file: missing project.json.');
  const projectBlob = await projectFile.async('blob');
  if (projectBlob.size > MAX_PROJECT_JSON_BYTES) {
    throw new Error('Invalid .layox file: project.json exceeds 5 MiB.');
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(await projectBlob.text()) as unknown;
  } catch {
    throw new Error('Invalid .layox file: project.json is not valid JSON.');
  }
  const project = migrateAndValidateProject(rawProject);

  const assetBlobs: Record<string, Blob> = {};
  for (const entry of zip.file(/^assets\//)) {
    if (entry.dir || entry.name.includes('..')) continue;
    assetBlobs[entry.name] = await entry.async('blob');
  }

  const missingAssets = [...collectReferencedAssetPaths(project)].filter((path) => !assetBlobs[path]);
  if (missingAssets.length > 0) {
    const preview = missingAssets.slice(0, 3).join(', ');
    throw new Error(`Invalid .layox file: missing referenced assets (${preview}).`);
  }

  return { project, assetBlobs };
}
