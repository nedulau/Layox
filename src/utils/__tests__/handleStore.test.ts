import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getHandle, removeHandle, storeHandle } from '../handleStore';

describe('handleStore', () => {
  it('stores, reads and removes a persisted file handle', async () => {
    const handle = { kind: 'file', name: 'album.layox' } as unknown as FileSystemFileHandle;

    await storeHandle('album.layox', handle);
    expect(await getHandle('album.layox')).toEqual(handle);

    await removeHandle('album.layox');
    expect(await getHandle('album.layox')).toBeNull();
  });
});
