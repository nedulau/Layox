import { createWebStoragePort } from './webStoragePort';
import type { StoragePort } from '../ports/storagePort';

function getCapacitorBridgeStorage() {
  return globalThis.capacitorBridge?.storage;
}

export function createCapacitorStoragePort(): StoragePort {
  const webStorageFallback = createWebStoragePort();

  return {
    getItem(key: string): string | null {
      const bridgeStorage = getCapacitorBridgeStorage();
      if (!bridgeStorage) return webStorageFallback.getItem(key);
      try {
        return bridgeStorage.getItem(key);
      } catch {
        return webStorageFallback.getItem(key);
      }
    },
    setItem(key: string, value: string): void {
      const bridgeStorage = getCapacitorBridgeStorage();
      if (!bridgeStorage) {
        webStorageFallback.setItem(key, value);
        return;
      }
      try {
        bridgeStorage.setItem(key, value);
      } catch {
        webStorageFallback.setItem(key, value);
      }
    },
    removeItem(key: string): void {
      const bridgeStorage = getCapacitorBridgeStorage();
      if (!bridgeStorage) {
        webStorageFallback.removeItem(key);
        return;
      }
      try {
        bridgeStorage.removeItem(key);
      } catch {
        webStorageFallback.removeItem(key);
      }
    },
  };
}
