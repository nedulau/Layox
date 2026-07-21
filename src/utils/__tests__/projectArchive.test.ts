import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../types';
import { createProjectArchiveBlob, loadProjectArchive } from '../projectArchive';
import { MAX_PROJECT_ARCHIVE_BYTES, MAX_PROJECT_JSON_BYTES } from '../../domain/projectSchema';

const project: Project = {
  meta: {
    id: 'project-1',
    name: 'Archive Test',
    version: '1.1',
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

    expect(loaded.project.meta.version).toBe('1.1');
    expect(loaded.project.meta.id).toEqual(expect.any(String));
  });

  it('migrates projects without an explicit version', async () => {
    const archive = await createArchive({
      meta: { name: 'Unversioned' },
      pages: [{ id: 'page', elements: [], background: '#fff' }],
    });

    const loaded = await loadProjectArchive(archive);

    expect(loaded.project.meta.version).toBe('1.1');
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

  it('rejects archives without project.json', async () => {
    const zip = new JSZip();
    zip.file('assets/photo.jpg', 'photo');
    await expect(loadProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('missing project.json');
  });
});
