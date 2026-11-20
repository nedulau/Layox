import type JSZip from 'jszip';
import type { Project } from '../types';
import {
  collectReferencedAssetPaths,
  isValidAssetPath,
  MAX_PROJECT_ARCHIVE_ENTRIES,
  MAX_PROJECT_ARCHIVE_BYTES,
  MAX_PROJECT_ASSET_BYTES,
  MAX_PROJECT_COMPRESSION_RATIO,
  MAX_PROJECT_JSON_BYTES,
  MAX_PROJECT_UNCOMPRESSED_BYTES,
  migrateAndValidateProject,
} from '../domain/projectSchema';

export interface ArchiveLimits {
  maxArchiveBytes: number;
  maxProjectJsonBytes: number;
  maxAssetBytes: number;
  maxUncompressedBytes: number;
  maxEntries: number;
  maxCompressionRatio: number;
}

const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxArchiveBytes: MAX_PROJECT_ARCHIVE_BYTES,
  maxProjectJsonBytes: MAX_PROJECT_JSON_BYTES,
  maxAssetBytes: MAX_PROJECT_ASSET_BYTES,
  maxUncompressedBytes: MAX_PROJECT_UNCOMPRESSED_BYTES,
  maxEntries: MAX_PROJECT_ARCHIVE_ENTRIES,
  maxCompressionRatio: MAX_PROJECT_COMPRESSION_RATIO,
};

type LoadedZipEntry = JSZip.JSZipObject & {
  _data?: {
    compressedSize?: number;
    uncompressedSize?: number;
  };
  unsafeOriginalName?: string;
  internalStream: (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array>;
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

function checkCompressionRatio(
  entryName: string,
  uncompressedBytes: number,
  compressedBytes: number,
  maxCompressionRatio: number,
): void {
  if (uncompressedBytes > 0 && uncompressedBytes / Math.max(1, compressedBytes) > maxCompressionRatio) {
    throw new Error(`Invalid .layox file: suspicious compression ratio for ${entryName}.`);
  }
}

export function validateArchiveMetadata(
  zip: JSZip,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): void {
  const entries = Object.values(zip.files);
  if (entries.length > limits.maxEntries) {
    throw new Error('Invalid .layox file: the archive contains too many entries.');
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const { compressed, uncompressed } = entrySizes(entry);

    if (entry.name === 'project.json') {
      if (uncompressed > limits.maxProjectJsonBytes) {
        throw new Error('Invalid .layox file: project.json exceeds 5 MiB.');
      }
      checkCompressionRatio(entry.name, uncompressed, compressed, limits.maxCompressionRatio);
      continue;
    }

    if (!entry.name.startsWith('assets/')) continue;
    const originalName = (entry as LoadedZipEntry).unsafeOriginalName ?? entry.name;
    if (!isValidAssetPath(entry.name) || !isValidAssetPath(originalName)) {
      throw new Error(`Invalid .layox file: invalid asset path ${originalName}.`);
    }
    if (uncompressed > limits.maxAssetBytes) {
      throw new Error(`Invalid .layox file: asset ${entry.name} exceeds 128 MiB.`);
    }
    checkCompressionRatio(entry.name, uncompressed, compressed, limits.maxCompressionRatio);
    totalUncompressed += uncompressed;
    if (totalUncompressed > limits.maxUncompressedBytes) {
      throw new Error('Invalid .layox file: uncompressed assets exceed 512 MiB.');
    }
  }
}

interface BoundedReadOptions {
  maxEntryBytes: number;
  entrySizeError: string;
  maxCompressionRatio: number;
  maxRemainingTotalBytes?: number;
}

function readEntryWithLimits(
  entry: JSZip.JSZipObject,
  options: BoundedReadOptions,
): Promise<{ blob: Blob; byteLength: number }> {
  const { compressed } = entrySizes(entry);
  const stream = (entry as LoadedZipEntry).internalStream('uint8array');
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let byteLength = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(error);
    };

    stream
      .on('data', (chunk) => {
        if (settled) return;
        byteLength += chunk.byteLength;
        if (byteLength > options.maxEntryBytes) {
          fail(new Error(options.entrySizeError));
          return;
        }
        if (options.maxRemainingTotalBytes !== undefined && byteLength > options.maxRemainingTotalBytes) {
          fail(new Error('Invalid .layox file: uncompressed assets exceed 512 MiB.'));
          return;
        }
        try {
          checkCompressionRatio(entry.name, byteLength, compressed, options.maxCompressionRatio);
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        chunks.push(new Uint8Array(chunk));
      })
      .on('error', () => {
        fail(new Error('Invalid .layox file: the ZIP archive is damaged.'));
      })
      .on('end', () => {
        if (settled) return;
        settled = true;
        resolve({ blob: new Blob(chunks), byteLength });
      })
      .resume();
  });
}

export async function createProjectArchiveBlob(
  project: Project,
  assetBlobs: Record<string, Blob>,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  for (const [path, blob] of Object.entries(assetBlobs)) {
    if (!isValidAssetPath(path)) {
      throw new Error(`Invalid asset path: ${path}.`);
    }
    zip.file(path, blob);
  }
  return zip.generateAsync({ type: 'blob', streamFiles: true });
}

export async function loadProjectArchive(
  file: Blob,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): Promise<{ project: Project; assetBlobs: Record<string, Blob> }> {
  if (file.size > limits.maxArchiveBytes) {
    throw new Error('The Layox project exceeds the 2 GiB archive limit.');
  }

  const { default: JSZip } = await import('jszip');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Invalid .layox file: the ZIP archive is damaged.');
  }
  validateArchiveMetadata(zip, limits);

  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .layox file: missing project.json.');
  const { blob: projectBlob } = await readEntryWithLimits(projectFile, {
    maxEntryBytes: limits.maxProjectJsonBytes,
    entrySizeError: 'Invalid .layox file: project.json exceeds 5 MiB.',
    maxCompressionRatio: limits.maxCompressionRatio,
  });

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(await projectBlob.text()) as unknown;
  } catch {
    throw new Error('Invalid .layox file: project.json is not valid JSON.');
  }
  const project = migrateAndValidateProject(rawProject);

  const assetBlobs: Record<string, Blob> = {};
  let extractedAssetBytes = 0;
  for (const entry of zip.file(/^assets\//)) {
    if (entry.dir) continue;
    const { blob, byteLength } = await readEntryWithLimits(entry, {
      maxEntryBytes: limits.maxAssetBytes,
      entrySizeError: `Invalid .layox file: asset ${entry.name} exceeds 128 MiB.`,
      maxCompressionRatio: limits.maxCompressionRatio,
      maxRemainingTotalBytes: limits.maxUncompressedBytes - extractedAssetBytes,
    });
    extractedAssetBytes += byteLength;
    assetBlobs[entry.name] = blob;
  }

  const missingAssets = [...collectReferencedAssetPaths(project)].filter((path) => !assetBlobs[path]);
  if (missingAssets.length > 0) {
    const preview = missingAssets.slice(0, 3).join(', ');
    throw new Error(`Invalid .layox file: missing referenced assets (${preview}).`);
  }

  return { project, assetBlobs };
}
