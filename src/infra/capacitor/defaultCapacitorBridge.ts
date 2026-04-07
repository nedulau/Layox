import type { CapacitorBridge, ProjectOpenPayload } from '../../types/platformBridges';

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
  return {
    openProject: async () => pickProjectFileWithInput(),
    storage: createStorageBridge(),
  };
}
