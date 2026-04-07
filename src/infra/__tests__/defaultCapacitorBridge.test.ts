import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCapacitorBridge } from '../capacitor/defaultCapacitorBridge';

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

describe('default capacitor bridge', () => {
  beforeEach(() => {
    globalThis.Capacitor = undefined;
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
  });

  it('uses localStorage-compatible storage bridge', () => {
    const bridge = createDefaultCapacitorBridge();
    expect(bridge.storage).toBeDefined();

    bridge.storage?.setItem('k', 'v');
    expect(bridge.storage?.getItem('k')).toBe('v');
    bridge.storage?.removeItem('k');
    expect(bridge.storage?.getItem('k')).toBeNull();
  });

  it('uses FilePicker plugin when available', async () => {
    const pickFiles = vi.fn().mockResolvedValue({
      files: [
        {
          name: 'mobile.layox',
          data: btoa('mobile-content'),
          path: '/documents/mobile.layox',
        },
      ],
    });

    globalThis.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        FilePicker: { pickFiles },
      },
    };

    const bridge = createDefaultCapacitorBridge();
    const opened = await bridge.openProject?.();

    expect(opened?.name).toBe('mobile.layox');
    expect(opened?.filePath).toBe('/documents/mobile.layox');
    expect(opened?.data).toBeInstanceOf(ArrayBuffer);
    expect(pickFiles).toHaveBeenCalledTimes(1);
  });

  it('exposes save functions when Filesystem plugin exists', async () => {
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///documents/Layox/test.layox' });

    globalThis.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Filesystem: { writeFile },
      },
    };

    const bridge = createDefaultCapacitorBridge();
    expect(typeof bridge.saveProject).toBe('function');
    expect(typeof bridge.saveProjectAs).toBe('function');

    const payload = {
      name: 'test.layox',
      data: new TextEncoder().encode('zip-data').buffer,
    };

    const saveResult = await bridge.saveProject?.(payload);
    const saveAsResult = await bridge.saveProjectAs?.(payload);

    expect(saveResult?.name).toContain('test');
    expect(saveResult?.name).toContain('layox');
    expect(saveAsResult?.name).toContain('test');
    expect(saveAsResult?.name).toContain('layox');
    expect(writeFile).toHaveBeenCalled();
  });

  it('openProjectFromPath reads through Filesystem plugin', async () => {
    const readFile = vi.fn().mockResolvedValue({
      data: btoa('from-path'),
    });

    globalThis.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Filesystem: { readFile, writeFile: vi.fn() },
      },
    };

    const bridge = createDefaultCapacitorBridge();
    const opened = await bridge.openProjectFromPath?.('/documents/path-project.layox');

    expect(opened?.name).toBe('path-project.layox');
    expect(opened?.filePath).toBe('/documents/path-project.layox');
    expect(opened?.data).toBeInstanceOf(ArrayBuffer);
    expect(readFile).toHaveBeenCalledTimes(1);
  });
});
