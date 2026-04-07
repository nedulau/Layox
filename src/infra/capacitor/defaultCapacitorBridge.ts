import type { CapacitorBridge, ProjectOpenPayload } from '../../types/platformBridges';

type CapacitorFilePickerFile = {
  name?: string;
  path?: string;
  uri?: string;
  data?: string;
  blob?: Blob;
};

type CapacitorFilePickerPlugin = {
  pickFiles: (options: { multiple?: boolean; types?: string[]; readData?: boolean }) => Promise<{ files: CapacitorFilePickerFile[] }>;
};

type CapacitorFilesystemPlugin = {
  readFile: (options: { path: string; directory?: string }) => Promise<{ data: string | Blob }>;
  writeFile: (options: { path: string; data: string; directory?: string; recursive?: boolean }) => Promise<{ uri?: string }>;
};

type CapacitorSharePlugin = {
  share: (options: { title?: string; text?: string; url?: string; dialogTitle?: string }) => Promise<void>;
};

function getCapacitorPlugins(): {
  FilePicker?: CapacitorFilePickerPlugin;
  Filesystem?: CapacitorFilesystemPlugin;
  Share?: CapacitorSharePlugin;
} {
  const runtime = globalThis.Capacitor;
  if (!runtime?.Plugins || typeof runtime.Plugins !== 'object') {
    return {};
  }

  return runtime.Plugins as {
    FilePicker?: CapacitorFilePickerPlugin;
    Filesystem?: CapacitorFilesystemPlugin;
    Share?: CapacitorSharePlugin;
  };
}

function normalizeBase64(data: string): string {
  const marker = 'base64,';
  const markerIndex = data.indexOf(marker);
  if (markerIndex >= 0) {
    return data.slice(markerIndex + marker.length).trim();
  }
  return data.trim();
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = normalizeBase64(base64);
  const binary = globalThis.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || 'project.layox';
}

async function readProjectFromPath(filePath: string): Promise<ProjectOpenPayload | null> {
  const plugins = getCapacitorPlugins();
  if (!plugins.Filesystem) return null;

  try {
    const result = await plugins.Filesystem.readFile({ path: filePath });
    if (result.data instanceof Blob) {
      return {
        name: getBaseName(filePath),
        data: await result.data.arrayBuffer(),
        filePath,
      };
    }

    return {
      name: getBaseName(filePath),
      data: base64ToArrayBuffer(result.data),
      filePath,
    };
  } catch {
    return null;
  }
}

async function pickProjectFileWithPlugin(): Promise<ProjectOpenPayload | null> {
  const plugins = getCapacitorPlugins();
  if (!plugins.FilePicker) return null;

  try {
    const result = await plugins.FilePicker.pickFiles({
      multiple: false,
      types: ['application/zip', '.layox'],
      readData: true,
    });
    const picked = result.files?.[0];
    if (!picked) return null;

    if (picked.blob instanceof Blob) {
      return {
        name: picked.name ?? 'project.layox',
        data: await picked.blob.arrayBuffer(),
        filePath: picked.path ?? picked.uri,
      };
    }

    if (typeof picked.data === 'string') {
      return {
        name: picked.name ?? 'project.layox',
        data: base64ToArrayBuffer(picked.data),
        filePath: picked.path ?? picked.uri,
      };
    }

    if (picked.path) {
      return readProjectFromPath(picked.path);
    }

    if (picked.uri) {
      return readProjectFromPath(picked.uri);
    }

    return null;
  } catch {
    return null;
  }
}

function createSafeProjectPath(name: string, forceUnique: boolean): string {
  const safeName = name.replace(/[^\p{L}\p{N}_\- ]/gu, '_') || 'layox-project';
  if (forceUnique) {
    return `Layox/${Date.now()}-${safeName}`;
  }
  return `Layox/${safeName}`;
}

async function writeProjectToFilesystem(path: string, data: ArrayBuffer): Promise<string | null> {
  const plugins = getCapacitorPlugins();
  if (!plugins.Filesystem) return null;

  const base64 = arrayBufferToBase64(data);

  try {
    const result = await plugins.Filesystem.writeFile({
      path,
      data: base64,
      directory: 'DOCUMENTS',
      recursive: true,
    });
    return result.uri ?? path;
  } catch {
    try {
      const result = await plugins.Filesystem.writeFile({
        path,
        data: base64,
        recursive: true,
      });
      return result.uri ?? path;
    } catch {
      return null;
    }
  }
}

function createStorageBridge() {
  return {
    getItem(key: string): string | null {
      try {
        return globalThis.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        globalThis.localStorage.setItem(key, value);
      } catch {
        // Ignore storage exceptions and keep app responsive.
      }
    },
    removeItem(key: string): void {
      try {
        globalThis.localStorage.removeItem(key);
      } catch {
        // Ignore storage exceptions and keep app responsive.
      }
    },
  };
}

async function pickProjectFileWithInput(): Promise<ProjectOpenPayload | null> {
  if (typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.layox,application/zip';
    input.style.display = 'none';

    const cleanup = () => {
      input.onchange = null;
      input.remove();
    };

    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const data = await file.arrayBuffer();
        resolve({
          name: file.name,
          data,
        });
      } catch {
        resolve(null);
      } finally {
        cleanup();
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

export function createDefaultCapacitorBridge(): CapacitorBridge {
  let lastSavedPath: string | null = null;

  const bridge: CapacitorBridge = {
    openProject: async () => {
      const pluginResult = await pickProjectFileWithPlugin();
      if (pluginResult) return pluginResult;
      return pickProjectFileWithInput();
    },
    openProjectFromPath: async (filePath: string) => readProjectFromPath(filePath),
    storage: createStorageBridge(),
  };

  if (getCapacitorPlugins().Filesystem) {
    bridge.saveProject = async (payload) => {
      const targetPath = lastSavedPath ?? createSafeProjectPath(payload.name, false);
      const writtenUri = await writeProjectToFilesystem(targetPath, payload.data);
      if (!writtenUri) return null;
      lastSavedPath = targetPath;
      return { name: getBaseName(targetPath) };
    };

    bridge.saveProjectAs = async (payload) => {
      const targetPath = createSafeProjectPath(payload.name, true);
      const writtenUri = await writeProjectToFilesystem(targetPath, payload.data);
      if (!writtenUri) return null;
      lastSavedPath = targetPath;

      const sharePlugin = getCapacitorPlugins().Share;
      if (sharePlugin && writtenUri) {
        try {
          await sharePlugin.share({
            title: 'Layox Project',
            text: 'Layox project export',
            url: writtenUri,
            dialogTitle: 'Share Layox Project',
          });
        } catch {
          // Ignore share errors; file is already written.
        }
      }

      return { name: getBaseName(targetPath) };
    };
  }

  return bridge;
}
