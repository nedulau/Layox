import type { StoragePort } from '../ports/storagePort';

export function createWebStoragePort(): StoragePort {
  const memoryFallback = new Map<string, string>();

  const getBackingStore = (): Storage | null => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  };

  return {
    getItem(key: string): string | null {
      const backingStore = getBackingStore();
      if (!backingStore) return memoryFallback.get(key) ?? null;
      try {
        return backingStore.getItem(key);
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    },
    setItem(key: string, value: string): void {
      const backingStore = getBackingStore();
      memoryFallback.set(key, value);
      if (!backingStore) return;
      try {
        backingStore.setItem(key, value);
      } catch {
        // Keep value in memory fallback if browser storage is unavailable.
      }
    },
    removeItem(key: string): void {
      const backingStore = getBackingStore();
      memoryFallback.delete(key);
      if (!backingStore) return;
      try {
        backingStore.removeItem(key);
      } catch {
        // Ignore remove errors to keep callsites simple.
      }
    },
  };
}
