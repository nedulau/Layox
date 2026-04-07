import { detectRuntimePlatform } from '../runtime';
import { installCapacitorBridge } from './installCapacitorBridge';
import { createDefaultCapacitorBridge } from './defaultCapacitorBridge';

export function ensureCapacitorBridgeInstalled(): void {
  const runtime = detectRuntimePlatform();
  if (runtime !== 'capacitor') return;
  if (globalThis.capacitorBridge) return;

  installCapacitorBridge(createDefaultCapacitorBridge());
}
