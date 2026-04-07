import { beforeEach, describe, expect, it } from 'vitest';
import { clearCapacitorBridge, installCapacitorBridge } from '../capacitor/installCapacitorBridge';
import { clearElectronBridge, installElectronBridge } from '../electron/installElectronBridge';
import { detectRuntimePlatform, isDesktopRuntime, isMobileRuntime } from '../runtime';

describe('runtime detection', () => {
  beforeEach(() => {
    clearElectronBridge();
    clearCapacitorBridge();
    globalThis.Capacitor = undefined;
  });

  it('defaults to web when no bridge exists', () => {
    expect(detectRuntimePlatform()).toBe('web');
    expect(isDesktopRuntime()).toBe(false);
    expect(isMobileRuntime()).toBe(false);
  });

  it('detects electron via bridge install', () => {
    installElectronBridge({});
    expect(detectRuntimePlatform()).toBe('electron');
    expect(isDesktopRuntime()).toBe(true);
    expect(isMobileRuntime()).toBe(false);
  });

  it('detects capacitor via bridge install', () => {
    installCapacitorBridge({});
    expect(detectRuntimePlatform()).toBe('capacitor');
    expect(isDesktopRuntime()).toBe(false);
    expect(isMobileRuntime()).toBe(true);
  });

  it('detects capacitor via native runtime hint', () => {
    globalThis.Capacitor = {
      isNativePlatform: () => true,
    };

    expect(detectRuntimePlatform()).toBe('capacitor');
  });

  it('prioritizes electron if both bridges are present', () => {
    installCapacitorBridge({});
    installElectronBridge({});

    expect(detectRuntimePlatform()).toBe('electron');
  });
});
