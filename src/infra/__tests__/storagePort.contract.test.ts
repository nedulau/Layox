import { beforeEach, describe, expect, it } from 'vitest';
import { createWebStoragePort } from '../adapters/webStoragePort';
import { createElectronStoragePort } from '../adapters/electronStoragePort';
import { createCapacitorStoragePort } from '../adapters/capacitorStoragePort';

function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear(): void {
      store = {};
    },
    getItem(key: string): string | null {
      return store[key] ?? null;
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string): void {
      delete store[key];
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

function runStorageContract(name: string, factory: () => ReturnType<typeof createWebStoragePort>) {
  describe(name, () => {
    beforeEach(() => {
      globalThis.localStorage.clear();
    });

    it('returns null for missing keys', () => {
      const port = factory();
      expect(port.getItem('missing')).toBeNull();
    });

    it('persists values with set/get', () => {
      const port = factory();
      port.setItem('theme', 'dark');
      expect(port.getItem('theme')).toBe('dark');
    });

    it('removes values', () => {
      const port = factory();
      port.setItem('language', 'de');
      port.removeItem('language');
      expect(port.getItem('language')).toBeNull();
    });
  });
}

describe('StoragePort contract', () => {
  beforeEach(() => {
    delete globalThis.electronBridge;
    delete globalThis.capacitorBridge;
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
    globalThis.localStorage.clear();
  });

  runStorageContract('web adapter', () => createWebStoragePort());
  runStorageContract('electron adapter fallback', () => createElectronStoragePort());
  runStorageContract('capacitor adapter fallback', () => createCapacitorStoragePort());

  it('uses electron storage bridge when present', () => {
    const bridgeStore = new Map<string, string>();
    globalThis.electronBridge = {
      storage: {
        getItem(key: string) {
          return bridgeStore.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          bridgeStore.set(key, value);
        },
        removeItem(key: string) {
          bridgeStore.delete(key);
        },
      },
    };

    const port = createElectronStoragePort();
    port.setItem('autosave', 'true');
    expect(bridgeStore.get('autosave')).toBe('true');
    expect(port.getItem('autosave')).toBe('true');
    port.removeItem('autosave');
    expect(port.getItem('autosave')).toBeNull();
  });

  it('uses capacitor storage bridge when present', () => {
    const bridgeStore = new Map<string, string>();
    globalThis.capacitorBridge = {
      storage: {
        getItem(key: string) {
          return bridgeStore.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          bridgeStore.set(key, value);
        },
        removeItem(key: string) {
          bridgeStore.delete(key);
        },
      },
    };

    const port = createCapacitorStoragePort();
    port.setItem('pdf', 'medium');
    expect(bridgeStore.get('pdf')).toBe('medium');
    expect(port.getItem('pdf')).toBe('medium');
  });
});
