import type { CapacitorBridge } from '../../types/platformBridges';

export function installCapacitorBridge(bridge: CapacitorBridge): void {
  globalThis.capacitorBridge = bridge;
  if (typeof window !== 'undefined') {
    window.capacitorBridge = bridge;
  }
}

export function clearCapacitorBridge(): void {
  delete globalThis.capacitorBridge;
  if (typeof window !== 'undefined') {
    delete window.capacitorBridge;
  }
}
