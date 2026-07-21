import type { Project } from '../types';

const DB_NAME = 'layox_recovery';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const ASSET_STORE = 'assets';
const MAX_SNAPSHOTS_PER_PROJECT = 12;

export interface RecoverySnapshot {
  id: string;
  projectId: string;
  createdAt: number;
  pageIndex: number;
  pageCount: number;
  projectName: string;
  project: Project;
  assetPaths: string[];
}

export type RecoverySummary = Omit<RecoverySnapshot, 'project' | 'assetPaths'>;

export interface RecoveredProject {
  project: Project;
  assetBlobs: Record<string, Blob>;
  pageIndex: number;
}

export interface RecoveryRepository {
  save(snapshot: Omit<RecoverySnapshot, 'assetPaths'>, assets: Record<string, Blob>): Promise<void>;
  list(projectId?: string): Promise<RecoverySummary[]>;
  restore(id: string): Promise<RecoveredProject>;
  remove(id: string): Promise<void>;
  prune(projectId: string): Promise<void>;
}

interface RecoveryAssetRecord {
  key: string;
  projectId: string;
  path: string;
  blob: Blob;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const snapshots = database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
      snapshots.createIndex('projectId', 'projectId');
      snapshots.createIndex('createdAt', 'createdAt');
      const assets = database.createObjectStore(ASSET_STORE, { keyPath: 'key' });
      assets.createIndex('projectId', 'projectId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function assetKey(projectId: string, path: string): string {
  return `${projectId}::${path}`;
}

async function writeSnapshot(
  snapshot: Omit<RecoverySnapshot, 'assetPaths'>,
  assets: Record<string, Blob>,
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SNAPSHOT_STORE, ASSET_STORE], 'readwrite');
    const assetStore = transaction.objectStore(ASSET_STORE);
    const paths = Object.keys(assets).sort();
    for (const path of paths) {
      const record: RecoveryAssetRecord = {
        key: assetKey(snapshot.projectId, path),
        projectId: snapshot.projectId,
        path,
        blob: assets[path],
      };
      assetStore.put(record);
    }
    transaction.objectStore(SNAPSHOT_STORE).put({ ...snapshot, assetPaths: paths });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

async function listSnapshotRecords(projectId?: string): Promise<RecoverySnapshot[]> {
  const database = await openDatabase();
  const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
  const store = transaction.objectStore(SNAPSHOT_STORE);
  const request = projectId
    ? store.index('projectId').getAll(IDBKeyRange.only(projectId))
    : store.getAll();
  const records = await requestResult(request) as RecoverySnapshot[];
  await transactionComplete(transaction);
  database.close();
  return records.sort((first, second) => second.createdAt - first.createdAt);
}

async function removeSnapshotsAndOrphanedAssets(ids: string[], projectId: string): Promise<void> {
  const database = await openDatabase();
  const deleteTransaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
  const snapshotStore = deleteTransaction.objectStore(SNAPSHOT_STORE);
  ids.forEach((id) => snapshotStore.delete(id));
  await transactionComplete(deleteTransaction);

  const snapshotTransaction = database.transaction(SNAPSHOT_STORE, 'readonly');
  const remaining = await requestResult(
    snapshotTransaction.objectStore(SNAPSHOT_STORE).index('projectId').getAll(IDBKeyRange.only(projectId)),
  ) as RecoverySnapshot[];
  await transactionComplete(snapshotTransaction);
  const referencedPaths = new Set(remaining.flatMap((snapshot) => snapshot.assetPaths));

  const assetReadTransaction = database.transaction(ASSET_STORE, 'readonly');
  const assetRecords = await requestResult(
    assetReadTransaction.objectStore(ASSET_STORE).index('projectId').getAll(IDBKeyRange.only(projectId)),
  ) as RecoveryAssetRecord[];
  await transactionComplete(assetReadTransaction);

  const assetDeleteTransaction = database.transaction(ASSET_STORE, 'readwrite');
  const assetStore = assetDeleteTransaction.objectStore(ASSET_STORE);
  for (const asset of assetRecords) {
    if (!referencedPaths.has(asset.path)) assetStore.delete(asset.key);
  }
  await transactionComplete(assetDeleteTransaction);
  database.close();
}

export const recoveryRepository: RecoveryRepository = {
  async save(snapshot, assets) {
    try {
      await writeSnapshot(snapshot, assets);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      const existing = await listSnapshotRecords(snapshot.projectId);
      const oldest = existing.at(-1);
      if (!oldest) throw error;
      await removeSnapshotsAndOrphanedAssets([oldest.id], snapshot.projectId);
      await writeSnapshot(snapshot, assets);
    }
    await this.prune(snapshot.projectId);
  },

  async list(projectId) {
    const records = await listSnapshotRecords(projectId);
    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      createdAt: record.createdAt,
      pageIndex: record.pageIndex,
      pageCount: record.pageCount,
      projectName: record.projectName,
    }));
  },

  async restore(id) {
    const database = await openDatabase();
    const snapshotTransaction = database.transaction(SNAPSHOT_STORE, 'readonly');
    const snapshot = await requestResult(
      snapshotTransaction.objectStore(SNAPSHOT_STORE).get(id),
    ) as RecoverySnapshot | undefined;
    await transactionComplete(snapshotTransaction);
    if (!snapshot) {
      database.close();
      throw new Error('Recovery snapshot not found.');
    }

    const assetTransaction = database.transaction(ASSET_STORE, 'readonly');
    const assetStore = assetTransaction.objectStore(ASSET_STORE);
    const records = await Promise.all(snapshot.assetPaths.map((path) => (
      requestResult(assetStore.get(assetKey(snapshot.projectId, path))) as Promise<RecoveryAssetRecord | undefined>
    )));
    const assetBlobs: Record<string, Blob> = {};
    for (const [index, path] of snapshot.assetPaths.entries()) {
      const asset = records[index];
      if (!asset) {
        database.close();
        throw new Error(`Recovery snapshot is missing asset: ${path}.`);
      }
      assetBlobs[path] = asset.blob;
    }
    await transactionComplete(assetTransaction);
    database.close();
    return { project: snapshot.project, assetBlobs, pageIndex: snapshot.pageIndex };
  },

  async remove(id) {
    const records = await listSnapshotRecords();
    const snapshot = records.find((candidate) => candidate.id === id);
    if (!snapshot) return;
    await removeSnapshotsAndOrphanedAssets([id], snapshot.projectId);
  },

  async prune(projectId) {
    const records = await listSnapshotRecords(projectId);
    const expired = records.slice(MAX_SNAPSHOTS_PER_PROJECT);
    if (expired.length > 0) {
      await removeSnapshotsAndOrphanedAssets(expired.map((snapshot) => snapshot.id), projectId);
    }
  },
};
