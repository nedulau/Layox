import { beforeEach, describe, expect, it } from 'vitest';
import { ensureCapacitorBridgeInstalled } from '../capacitor/bootstrapCapacitorBridge';
import { clearCapacitorBridge } from '../capacitor/installCapacitorBridge';

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

describe('capacitor bridge bootstrap', () => {
  beforeEach(() => {
    clearCapacitorBridge();
    globalThis.Capacitor = undefined;
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
  });

  it('does not install bridge outside capacitor runtime', () => {
    ensureCapacitorBridgeInstalled();
    expect(globalThis.capacitorBridge).toBeUndefined();
  });

  it('installs default bridge in capacitor runtime', () => {
    globalThis.Capacitor = {
      isNativePlatform: () => true,
    };

    ensureCapacitorBridgeInstalled();

    expect(globalThis.capacitorBridge).toBeDefined();
    expect(typeof globalThis.capacitorBridge?.openProject).toBe('function');
    expect(globalThis.capacitorBridge?.storage).toBeDefined();
  });

  it('uses storage bridge with localStorage-compatible behavior', () => {
    globalThis.Capacitor = {
      isNativePlatform: () => true,
    };

    ensureCapacitorBridgeInstalled();
    const storage = globalThis.capacitorBridge?.storage;

    expect(storage).toBeDefined();
    storage?.setItem('layox_key', 'layox_value');
    expect(storage?.getItem('layox_key')).toBe('layox_value');
    storage?.removeItem('layox_key');
    expect(storage?.getItem('layox_key')).toBeNull();
  });

  it('does not overwrite a manually installed bridge', () => {
    globalThis.Capacitor = {
      isNativePlatform: () => true,
    };

    const customBridge = {
      openProject: async () => null,
      storage: {
        getItem: () => 'x',
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    };

    globalThis.capacitorBridge = customBridge;
    ensureCapacitorBridgeInstalled();

    expect(globalThis.capacitorBridge).toBe(customBridge);
  });
});
