import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types';
import {
  recoveryRepository,
  type RecoverySnapshot,
} from '../recoveryRepository';

const DATABASE_NAME = 'layox_recovery';
Object.defineProperty(globalThis, 'Blob', { value: NodeBlob, configurable: true });

function deleteRecoveryDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Recovery database deletion was blocked.'));
  });
}

function createProject(id = 'project-1'): Project {
  return {
    meta: { id, name: 'Recovered album', version: '1.1' },
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
}

function createSnapshot(
  id: string,
  createdAt: number,
  project = createProject(),
): Omit<RecoverySnapshot, 'assetPaths'> {
  return {
    id,
    projectId: project.meta.id,
    createdAt,
    pageIndex: 0,
    pageCount: project.pages.length,
    projectName: project.meta.name,
    project,
  };
}

async function countRecords(storeName: string): Promise<number> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(storeName, 'readonly');
  const count = await new Promise<number>((resolve, reject) => {
    const request = transaction.objectStore(storeName).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return count;
}

describe('recoveryRepository', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await deleteRecoveryDatabase();
  });

  it('restores the full project, page position and image blobs', async () => {
    const project = createProject();
    await recoveryRepository.save(createSnapshot('snapshot-1', 100, project), {
      'assets/photo.jpg': new Blob(['image-data'], { type: 'image/jpeg' }),
    });

    const recovered = await recoveryRepository.restore('snapshot-1');

    expect(recovered.project).toEqual(project);
    expect(recovered.pageIndex).toBe(0);
    expect(await recovered.assetBlobs['assets/photo.jpg'].text()).toBe('image-data');
  });

  it('deduplicates unchanged assets between snapshots', async () => {
    const asset = { 'assets/photo.jpg': new Blob(['image-data']) };
    await recoveryRepository.save(createSnapshot('snapshot-1', 100), asset);
    await recoveryRepository.save(createSnapshot('snapshot-2', 200), asset);

    expect(await recoveryRepository.list('project-1')).toHaveLength(2);
    expect(await countRecords('assets')).toBe(1);
  });

  it('keeps twelve snapshots per project and removes orphaned assets', async () => {
    for (let index = 0; index < 13; index += 1) {
      await recoveryRepository.save(createSnapshot(`snapshot-${index}`, index), {
        [`assets/photo-${index}.jpg`]: new Blob([String(index)]),
      });
    }

    const summaries = await recoveryRepository.list('project-1');
    expect(summaries).toHaveLength(12);
    expect(summaries.map((summary) => summary.id)).not.toContain('snapshot-0');
    expect(await countRecords('assets')).toBe(12);
  });

  it('removes a snapshot and its unreferenced assets', async () => {
    await recoveryRepository.save(createSnapshot('snapshot-1', 100), {
      'assets/photo.jpg': new Blob(['image-data']),
    });

    await recoveryRepository.remove('snapshot-1');

    expect(await recoveryRepository.list('project-1')).toEqual([]);
    expect(await countRecords('assets')).toBe(0);
    await expect(recoveryRepository.restore('snapshot-1')).rejects.toThrow('not found');
  });

  it('removes the oldest snapshot and retries once after a quota error', async () => {
    await recoveryRepository.save(createSnapshot('oldest', 100), {});
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage quota reached.', 'QuotaExceededError');
    });

    await recoveryRepository.save(createSnapshot('replacement', 200), {});

    expect((await recoveryRepository.list('project-1')).map((summary) => summary.id)).toEqual(['replacement']);
  });
});
