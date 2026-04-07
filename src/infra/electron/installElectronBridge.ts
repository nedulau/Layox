import type { ElectronBridge } from '../../types/platformBridges';

export function installElectronBridge(bridge: ElectronBridge): void {
  globalThis.electronBridge = bridge;
  if (typeof window !== 'undefined') {
    window.electronBridge = bridge;
  }
}

export function clearElectronBridge(): void {
  delete globalThis.electronBridge;
  if (typeof window !== 'undefined') {
    delete window.electronBridge;
  }
}
