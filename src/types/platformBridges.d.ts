export interface ProjectBinaryPayload {
  name: string;
  data: ArrayBuffer;
}

export interface PlatformStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ElectronBridge {
  openProject?: () => Promise<ProjectBinaryPayload | null>;
  saveProject?: (payload: ProjectBinaryPayload) => Promise<{ name: string } | null>;
  saveProjectAs?: (payload: ProjectBinaryPayload) => Promise<{ name: string } | null>;
  storage?: PlatformStorageBridge;
}

export interface CapacitorBridge {
  openProject?: () => Promise<ProjectBinaryPayload | null>;
  saveProject?: (payload: ProjectBinaryPayload) => Promise<{ name: string } | null>;
  saveProjectAs?: (payload: ProjectBinaryPayload) => Promise<{ name: string } | null>;
  storage?: PlatformStorageBridge;
}

declare global {
  var electronBridge: ElectronBridge | undefined;
  var capacitorBridge: CapacitorBridge | undefined;
  var Capacitor:
    | {
      isNativePlatform?: () => boolean;
    }
    | undefined;

  interface Window {
    electronBridge?: ElectronBridge;
    capacitorBridge?: CapacitorBridge;
    Capacitor?: typeof Capacitor;
  }
}

export {};
