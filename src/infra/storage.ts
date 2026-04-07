import { createWebStoragePort } from './adapters/webStoragePort';
import { createElectronStoragePort } from './adapters/electronStoragePort';
import { createCapacitorStoragePort } from './adapters/capacitorStoragePort';
import { detectRuntimePlatform } from './runtime';
import type { StoragePort } from './ports/storagePort';

let storagePort: StoragePort | null = null;

function createStoragePortForRuntime(): StoragePort {
  const runtime = detectRuntimePlatform();

  switch (runtime) {
    case 'electron':
      return createElectronStoragePort();
    case 'capacitor':
      return createCapacitorStoragePort();
    case 'web':
    default:
      return createWebStoragePort();
  }
}

export function getStoragePort(): StoragePort {
  if (!storagePort) {
    storagePort = createStoragePortForRuntime();
  }
  return storagePort;
}

export function readStoredString(key: string, fallback: string): string {
  const value = getStoragePort().getItem(key);
  return value ?? fallback;
}

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  const value = getStoragePort().getItem(key);
  if (value === null) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function readStoredNumber(key: string, fallback: number): number {
  const value = getStoragePort().getItem(key);
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readStoredJson<T>(key: string, fallback: T): T {
  const value = getStoragePort().getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredString(key: string, value: string): void {
  getStoragePort().setItem(key, value);
}

export function removeStoredValue(key: string): void {
  getStoragePort().removeItem(key);
}
