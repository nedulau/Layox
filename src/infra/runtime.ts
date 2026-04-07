export type RuntimePlatform = 'web' | 'electron' | 'capacitor';

export function detectRuntimePlatform(): RuntimePlatform {
  const globalWithHints = globalThis as typeof globalThis & {
    process?: {
      versions?: {
        electron?: string;
      };
    };
  };

  if (globalThis.electronBridge) {
    return 'electron';
  }

  if (globalWithHints.process?.versions?.electron) {
    return 'electron';
  }

  if (globalThis.capacitorBridge) {
    return 'capacitor';
  }

  if (globalThis.Capacitor?.isNativePlatform?.()) {
    return 'capacitor';
  }

  return 'web';
}

export function isDesktopRuntime(): boolean {
  return detectRuntimePlatform() === 'electron';
}

export function isMobileRuntime(): boolean {
  return detectRuntimePlatform() === 'capacitor';
}
