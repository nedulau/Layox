import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../types';
import { createProjectArchiveBlob, loadProjectArchive, validateArchiveMetadata } from '../projectArchive';
import {
  MAX_PROJECT_ARCHIVE_BYTES,
  MAX_PROJECT_ARCHIVE_ENTRIES,
  MAX_PROJECT_ASSET_BYTES,
  MAX_PROJECT_COMPRESSION_RATIO,
  MAX_PROJECT_JSON_BYTES,
  MAX_PROJECT_UNCOMPRESSED_BYTES,
} from '../../domain/projectSchema';

const project: Project = {
  meta: {
    id: 'project-1',
    name: 'Archive Test',
    version: '1.2',
    defaultLayoutPadding: 20,
    defaultLayoutGap: 20,
  },
  pages: [
    {
      id: 'page-1',
      background: '#ffffff',
      elements: [
        {
          id: 'image-1',
          type: 'image',
          x: 10,
          y: 20,
          width: 300,
          height: 200,
          rotation: 0,
          zIndex: 0,
          src: 'assets/photo.jpg',
        },
      ],
    },
  ],
};

async function createArchive(rawProject: unknown, assets: Record<string, Blob> = {}): Promise<Blob> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(rawProject));
  for (const [path, blob] of Object.entries(assets)) zip.file(path, blob);
  return zip.generateAsync({ type: 'blob' });
}

function metadataArchive(entries: Array<{
  name: string;
  compressed: number;
  uncompressed: number;
  unsafeOriginalName?: string;
}>): JSZip {
  return {
    files: Object.fromEntries(entries.map((entry) => [entry.name, {
      name: entry.name,
      dir: false,
      unsafeOriginalName: entry.unsafeOriginalName,
      _data: { compressedSize: entry.compressed, uncompressedSize: entry.uncompressed },
    }])),
  } as unknown as JSZip;
}

function patchZipUncompressedSizes(rawBytes: Uint8Array, entryName: string, forgedSize: number): Uint8Array<ArrayBuffer> {
  const patched = new Uint8Array(rawBytes);
  const view = new DataView(patched.buffer, patched.byteOffset, patched.byteLength);
  const nameBytes = new TextEncoder().encode(entryName);

  const matchesNameAt = (offset: number): boolean => {
    if (offset + nameBytes.length > patched.length) return false;
    for (let index = 0; index < nameBytes.length; index += 1) {
      if (patched[offset + index] !== nameBytes[index]) return false;
    }
    return true;
  };

  for (let offset = 0; offset <= patched.length - 46; offset += 1) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x04034b50) {
      const fileNameLength = view.getUint16(offset + 26, true);
      if (fileNameLength === nameBytes.length && matchesNameAt(offset + 30)) {
        view.setUint32(offset + 22, forgedSize, true);
      }
    } else if (signature === 0x02014b50) {
      const fileNameLength = view.getUint16(offset + 28, true);
      if (fileNameLength === nameBytes.length && matchesNameAt(offset + 46)) {
        view.setUint32(offset + 24, forgedSize, true);
      }
    }
  }
  return patched;
}

describe('project archive', () => {
  it('round-trips a current project and its assets', async () => {
    const photo = new Blob(['photo'], { type: 'image/jpeg' });
    const archive = await createProjectArchiveBlob(project, { 'assets/photo.jpg': photo });

    const loaded = await loadProjectArchive(archive);

    expect(loaded.project).toEqual(project);
    expect(await loaded.assetBlobs['assets/photo.jpg'].text()).toBe('photo');
  });

  it('migrates version 1.0 and assigns a stable project id', async () => {
    const archive = await createArchive({
      meta: { name: 'Legacy', version: '1.0' },
      pages: [{ id: 'legacy-page', elements: [], background: '#fff' }],
    });

    const loaded = await loadProjectArchive(archive);

    expect(loaded.project.meta.version).toBe('1.2');
    expect(loaded.project.meta.id).toEqual(expect.any(String));
  });

  it('migrates projects without an explicit version', async () => {
    const archive = await createArchive({
      meta: { name: 'Unversioned' },
      pages: [{ id: 'page', elements: [], background: '#fff' }],
    });

    const loaded = await loadProjectArchive(archive);

    expect(loaded.project.meta.version).toBe('1.2');
  });

  it('rejects unsupported future versions', async () => {
    const archive = await createArchive({
      meta: { id: 'future', name: 'Future', version: '2.0' },
      pages: [{ id: 'page', elements: [], background: '#fff' }],
    });

    await expect(loadProjectArchive(archive)).rejects.toThrow('Unsupported Layox project version');
  });

  it('rejects missing referenced assets', async () => {
    const archive = await createArchive(project);

    await expect(loadProjectArchive(archive)).rejects.toThrow('missing referenced assets');
  });

  it('rejects invalid element coordinates', async () => {
    const invalidProject = structuredClone(project) as unknown as {
      pages: Array<{ elements: Array<{ x: unknown }> }>;
    };
    invalidProject.pages[0].elements[0].x = 'left';
    const archive = await createArchive(invalidProject, {
      'assets/photo.jpg': new Blob(['photo']),
    });

    await expect(loadProjectArchive(archive)).rejects.toThrow('must be a finite number');
  });

  it('rejects damaged ZIP data without exposing parser details', async () => {
    await expect(loadProjectArchive(new Blob(['not a zip']))).rejects.toThrow('ZIP archive is damaged');
  });

  it('rejects invalid asset paths while creating an archive', async () => {
    await expect(createProjectArchiveBlob(project, {
      '../photo.jpg': new Blob(['photo']),
    })).rejects.toThrow('Invalid asset path');
  });

  it('rejects archives above the configured size before parsing', async () => {
    const oversized = { size: MAX_PROJECT_ARCHIVE_BYTES + 1 } as Blob;
    await expect(loadProjectArchive(oversized)).rejects.toThrow('2 GiB');
  });

  it('rejects project.json above five MiB', async () => {
    const zip = new JSZip();
    zip.file('project.json', ' '.repeat(MAX_PROJECT_JSON_BYTES + 1));
    const archive = await zip.generateAsync({ type: 'blob' });

    await expect(loadProjectArchive(archive)).rejects.toThrow('5 MiB');
  });

  it('rejects highly compressed assets before extracting them', async () => {
    const compressedProject = structuredClone(project);
    const image = compressedProject.pages[0].elements[0];
    if (image.type !== 'image') throw new Error('Expected image fixture.');
    compressedProject.pages[0].elements[0] = {
      ...image,
      src: 'assets/bomb.bin',
    };
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(compressedProject));
    zip.file('assets/bomb.bin', new Uint8Array(1024 * 1024));
    const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    await expect(loadProjectArchive(archive)).rejects.toThrow('suspicious compression ratio');
  });

  it('rejects malformed ZIP metadata', () => {
    const archive = { files: { 'project.json': { name: 'project.json', dir: false } } } as unknown as JSZip;
    expect(() => validateArchiveMetadata(archive)).toThrow('invalid ZIP metadata');
  });

  it('rejects archives with too many entries', () => {
    const files = Object.fromEntries(Array.from(
      { length: MAX_PROJECT_ARCHIVE_ENTRIES + 1 },
      (_, index) => [`extra-${index}`, { name: `extra-${index}`, dir: true }],
    ));
    expect(() => validateArchiveMetadata({ files } as unknown as JSZip)).toThrow('too many entries');
  });

  it('rejects unsafe and oversized asset metadata', () => {
    expect(() => validateArchiveMetadata(metadataArchive([{
      name: 'assets/photo.jpg',
      unsafeOriginalName: 'assets/../photo.jpg',
      compressed: 1,
      uncompressed: 1,
    }]))).toThrow('invalid asset path');

    expect(() => validateArchiveMetadata(metadataArchive([{
      name: 'assets/large.raw',
      compressed: MAX_PROJECT_ASSET_BYTES + 1,
      uncompressed: MAX_PROJECT_ASSET_BYTES + 1,
    }]))).toThrow('exceeds 128 MiB');
  });

  it('rejects excessive cumulative asset metadata', () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({
      name: `assets/large-${index}.raw`,
      compressed: MAX_PROJECT_ASSET_BYTES,
      uncompressed: MAX_PROJECT_ASSET_BYTES,
    }));
    expect(() => validateArchiveMetadata(metadataArchive(entries))).toThrow('exceed 512 MiB');
  });

  it('rejects invalid project JSON from an otherwise valid archive', async () => {
    const zip = new JSZip();
    zip.file('project.json', '{');
    await expect(loadProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('not valid JSON');
  });

  it('rejects archives without project.json', async () => {
    const zip = new JSZip();
    zip.file('assets/photo.jpg', 'photo');
    await expect(loadProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('missing project.json');
  });

  it('rejects project.json with a suspicious compression ratio', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project) + ' '.repeat(1024 * 1024));
    const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    await expect(loadProjectArchive(archive)).rejects.toThrow('suspicious compression ratio for project.json');
  });

  it('rejects spoofed asset headers during streaming decompression when exceeding entry size', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    zip.file('assets/photo.jpg', new Uint8Array(64 * 1024).fill(65));
    const rawBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const forgedArchive = new Blob([patchZipUncompressedSizes(rawBytes, 'assets/photo.jpg', 16)]);

    await expect(loadProjectArchive(forgedArchive, {
      maxArchiveBytes: MAX_PROJECT_ARCHIVE_BYTES,
      maxProjectJsonBytes: MAX_PROJECT_JSON_BYTES,
      maxAssetBytes: 4 * 1024,
      maxUncompressedBytes: MAX_PROJECT_UNCOMPRESSED_BYTES,
      maxEntries: MAX_PROJECT_ARCHIVE_ENTRIES,
      maxCompressionRatio: 10_000,
    })).rejects.toThrow('exceeds 128 MiB');
  });

  it('rejects spoofed asset headers during streaming decompression when exceeding cumulative budget', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    zip.file('assets/photo.jpg', new Uint8Array(3 * 1024).fill(65));
    zip.file('assets/extra.jpg', new Uint8Array(3 * 1024).fill(66));
    const rawBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const forgedSecond = patchZipUncompressedSizes(rawBytes, 'assets/extra.jpg', 16);

    await expect(loadProjectArchive(new Blob([forgedSecond]), {
      maxArchiveBytes: MAX_PROJECT_ARCHIVE_BYTES,
      maxProjectJsonBytes: MAX_PROJECT_JSON_BYTES,
      maxAssetBytes: 4 * 1024,
      maxUncompressedBytes: 5 * 1024,
      maxEntries: MAX_PROJECT_ARCHIVE_ENTRIES,
      maxCompressionRatio: 10_000,
    })).rejects.toThrow('uncompressed assets exceed 512 MiB');
  });

  it('rejects archives whose decompressed stream disagrees with ZIP integrity headers', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    zip.file('assets/photo.jpg', new Uint8Array(2 * 1024).fill(65));
    const rawBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const forged = patchZipUncompressedSizes(rawBytes, 'assets/photo.jpg', 16);

    await expect(loadProjectArchive(new Blob([forged]))).rejects.toThrow('ZIP archive is damaged');
  });

  it('rejects spoofed compression ratio headers during streaming decompression', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    zip.file('assets/photo.jpg', new Uint8Array(512 * 1024));
    const rawBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const forgedArchive = new Blob([patchZipUncompressedSizes(rawBytes, 'assets/photo.jpg', 16)]);

    await expect(loadProjectArchive(forgedArchive, {
      maxArchiveBytes: MAX_PROJECT_ARCHIVE_BYTES,
      maxProjectJsonBytes: MAX_PROJECT_JSON_BYTES,
      maxAssetBytes: MAX_PROJECT_ASSET_BYTES,
      maxUncompressedBytes: MAX_PROJECT_UNCOMPRESSED_BYTES,
      maxEntries: MAX_PROJECT_ARCHIVE_ENTRIES,
      maxCompressionRatio: MAX_PROJECT_COMPRESSION_RATIO,
    })).rejects.toThrow('suspicious compression ratio for assets/photo.jpg');
  });

  it('rejects spoofed project.json headers during streaming decompression', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project) + ' '.repeat(16 * 1024));
    zip.file('assets/photo.jpg', new Blob(['photo']));
    const rawBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const forgedArchive = new Blob([patchZipUncompressedSizes(rawBytes, 'project.json', 16)]);

    await expect(loadProjectArchive(forgedArchive, {
      maxArchiveBytes: MAX_PROJECT_ARCHIVE_BYTES,
      maxProjectJsonBytes: 4 * 1024,
      maxAssetBytes: MAX_PROJECT_ASSET_BYTES,
      maxUncompressedBytes: MAX_PROJECT_UNCOMPRESSED_BYTES,
      maxEntries: MAX_PROJECT_ARCHIVE_ENTRIES,
      maxCompressionRatio: 10_000,
    })).rejects.toThrow('project.json exceeds 5 MiB');
  });

  it('rejects asset paths with backslashes or control characters in metadata and archive creation', async () => {
    expect(() => validateArchiveMetadata(metadataArchive([{
      name: 'assets/sub\\photo.jpg',
      compressed: 1,
      uncompressed: 1,
    }]))).toThrow('invalid asset path');

    await expect(createProjectArchiveBlob(project, {
      'assets/bad\u0000.jpg': new Blob(['photo']),
    })).rejects.toThrow('Invalid asset path');
  });
});
