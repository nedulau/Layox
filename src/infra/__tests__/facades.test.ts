import { beforeEach, describe, expect, it } from 'vitest';
import { getFileSystemPort } from '../fileSystem';
import {
  readStoredBoolean,
  readStoredJson,
  readStoredNumber,
  readStoredString,
  removeStoredValue,
  writeStoredString,
} from '../storage';

const storageData = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return storageData.size; },
  clear: () => storageData.clear(),
  getItem: (key) => storageData.get(key) ?? null,
  key: (index) => [...storageData.keys()][index] ?? null,
  removeItem: (key) => { storageData.delete(key); },
  setItem: (key, value) => { storageData.set(key, value); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });

describe('runtime facades', () => {
  beforeEach(() => localStorage.clear());

  it('returns a stable web file-system port', () => {
    expect(getFileSystemPort()).toBe(getFileSystemPort());
    expect(getFileSystemPort().supportsNativePicker()).toBe(false);
  });

  it('reads and writes typed storage values with safe fallbacks', () => {
    expect(readStoredString('missing', 'fallback')).toBe('fallback');
    expect(readStoredBoolean('missing', true)).toBe(true);
    expect(readStoredNumber('missing', 42)).toBe(42);
    expect(readStoredJson('missing', { ok: true })).toEqual({ ok: true });

    writeStoredString('bool', 'true');
    writeStoredString('false', 'false');
    writeStoredString('invalid-bool', 'maybe');
    writeStoredString('number', '12');
    writeStoredString('invalid-number', 'nope');
    writeStoredString('json', '{"value":1}');
    writeStoredString('invalid-json', '{');

    expect(readStoredBoolean('bool', false)).toBe(true);
    expect(readStoredBoolean('false', true)).toBe(false);
    expect(readStoredBoolean('invalid-bool', true)).toBe(true);
    expect(readStoredNumber('number', 0)).toBe(12);
    expect(readStoredNumber('invalid-number', 7)).toBe(7);
    expect(readStoredJson('json', {})).toEqual({ value: 1 });
    expect(readStoredJson('invalid-json', { fallback: true })).toEqual({ fallback: true });

    removeStoredValue('bool');
    expect(localStorage.getItem('bool')).toBeNull();
  });
});
