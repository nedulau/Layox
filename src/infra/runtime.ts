export type RuntimePlatform = 'web' | 'electron' | 'capacitor';

export function detectRuntimePlatform(): RuntimePlatform {
  const globalWithHints = globalThis as typeof globalThis & {
    process?: {
      versions?: {
        electron?: string;
      };
    };
    Capacitor?: unknown;
  };

  if (globalWithHints.process?.versions?.electron) {
    return 'electron';
  }

  if (globalWithHints.Capacitor) {
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
