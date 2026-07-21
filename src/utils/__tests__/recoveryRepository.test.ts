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

async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
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

  it('keeps a shared asset while another snapshot still references it', async () => {
    const asset = { 'assets/photo.jpg': new Blob(['image-data']) };
    await recoveryRepository.save(createSnapshot('snapshot-1', 100), asset);
    await recoveryRepository.save(createSnapshot('snapshot-2', 200), asset);

    await recoveryRepository.remove('snapshot-1');

    expect(await countRecords('assets')).toBe(1);
    expect(await recoveryRepository.restore('snapshot-2')).toMatchObject({ pageIndex: 0 });
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

  it('rejects a restore when a referenced recovery asset is missing', async () => {
    await recoveryRepository.save(createSnapshot('snapshot-1', 100), {
      'assets/photo.jpg': new Blob(['photo']),
    });
    await deleteRecord('assets', 'project-1::assets/photo.jpg');

    await expect(recoveryRepository.restore('snapshot-1')).rejects.toThrow('missing asset');
  });

  it('ignores removal of an unknown snapshot', async () => {
    await expect(recoveryRepository.remove('unknown')).resolves.toBeUndefined();
  });

  it('does not retry non-quota storage failures', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });

    await expect(recoveryRepository.save(createSnapshot('snapshot-1', 100), {}))
      .rejects.toThrow('database unavailable');
  });

  it('surfaces an initial quota error when no older snapshot can be pruned', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage quota reached.', 'QuotaExceededError');
    });

    await expect(recoveryRepository.save(createSnapshot('snapshot-1', 100), {}))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
  });

  it('only retries a quota-limited write once', async () => {
    await recoveryRepository.save(createSnapshot('oldest', 100), {});
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Storage quota reached.', 'QuotaExceededError');
    });

    await expect(recoveryRepository.save(createSnapshot('replacement', 200), {}))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
  });

  it('rejects when an IndexedDB transaction is aborted', async () => {
    const nativeTransaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (
      this: IDBDatabase,
      storeNames: string | Iterable<string>,
      mode: IDBTransactionMode = 'readonly',
      options?: IDBTransactionOptions,
    ) {
      const transaction = nativeTransaction.call(this, storeNames, mode, options);
      queueMicrotask(() => transaction.abort());
      return transaction;
    });

    await expect(recoveryRepository.save(createSnapshot('snapshot-1', 100), {})).rejects.toBeTruthy();
  });

  it('rejects when an IndexedDB transaction reports an error event', async () => {
    const nativeTransaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (
      this: IDBDatabase,
      storeNames: string | Iterable<string>,
      mode: IDBTransactionMode = 'readonly',
      options?: IDBTransactionOptions,
    ) {
      const transaction = nativeTransaction.call(this, storeNames, mode, options);
      queueMicrotask(() => transaction.onerror?.call(transaction, new Event('error')));
      return transaction;
    });

    await expect(recoveryRepository.save(createSnapshot('snapshot-1', 100), {})).rejects.toBeNull();
  });
});
