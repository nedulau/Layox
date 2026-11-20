// @vitest-environment node
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertTargetNotSymlink,
  createEmptyStorageCache,
  createProjectPathAuthorizer,
  extractRecentProjectPaths,
  getStorageEntry,
  isValidProjectFileName,
  isValidProjectPath,
  isValidSavePayload,
  isValidStorageKey,
  readRegularProjectFile,
  sanitizeStorageRecord,
} from '../security.mjs';

/** @type {string[]} */
const temporaryDirectories = [];

async function createTempDir() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'layox-sec-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('electron main security helpers', () => {
  it('validates project filenames strictly as pure basenames', () => {
    expect(isValidProjectFileName('album.layox')).toBe(true);
    expect(isValidProjectFileName('My Album 2026.LAYOX')).toBe(true);
    expect(isValidProjectFileName('../evil.layox')).toBe(false);
    expect(isValidProjectFileName('dir/album.layox')).toBe(false);
    expect(isValidProjectFileName('dir\\album.layox')).toBe(false);
    expect(isValidProjectFileName('album..layox')).toBe(false);
    expect(isValidProjectFileName('album\u0000.layox')).toBe(false);
    expect(isValidProjectFileName('album.txt')).toBe(false);
    expect(isValidProjectFileName('')).toBe(false);
  });

  it('validates save payloads and rejects traversal filenames', () => {
    const data = new Uint8Array([80, 75, 3, 4]).buffer;
    expect(isValidSavePayload({ name: 'album.layox', data })).toBe(true);
    expect(isValidSavePayload({ name: '../album.layox', data })).toBe(false);
    expect(isValidSavePayload({ name: 'album.layox', data, targetPath: '/tmp/album.layox' })).toBe(true);
    expect(isValidSavePayload({ name: 'album.layox', data, targetPath: 'relative.layox' })).toBe(false);
    expect(isValidSavePayload({ name: 'album.layox', data, targetPath: '/tmp/album\u0000.layox' })).toBe(false);
  });

  it('rejects prototype keys and isolates storage cache from Object.prototype', () => {
    expect(isValidStorageKey('layox_language')).toBe(true);
    expect(isValidStorageKey('__proto__')).toBe(false);
    expect(isValidStorageKey('constructor')).toBe(false);
    expect(isValidStorageKey('prototype')).toBe(false);
    expect(isValidStorageKey('bad\u0000key')).toBe(false);

    const cache = createEmptyStorageCache();
    expect(Object.getPrototypeOf(cache)).toBeNull();
    expect(getStorageEntry(cache, 'toString')).toBeNull();

    const parsed = JSON.parse('{"layox_uiTheme":"dark","__proto__":"bad","constructor":"bad","num":123}');
    const sanitized = sanitizeStorageRecord(parsed);
    expect(Object.getPrototypeOf(sanitized)).toBeNull();
    expect(getStorageEntry(sanitized, 'layox_uiTheme')).toBe('dark');
    expect(getStorageEntry(sanitized, '__proto__')).toBeNull();
    expect(getStorageEntry(sanitized, 'constructor')).toBeNull();
    expect(getStorageEntry(sanitized, 'num')).toBeNull();
  });

  it('authorizes only dialog-granted or persisted recent project paths', async () => {
    const directory = await createTempDir();
    const grantedPath = path.join(directory, 'granted.layox');
    const persistedPath = path.join(directory, 'persisted.layox');
    const ungrantedPath = path.join(directory, 'ungranted.layox');
    await writeFile(grantedPath, 'PK\x03\x04');
    await writeFile(persistedPath, 'PK\x03\x04');
    await writeFile(ungrantedPath, 'PK\x03\x04');

    const authorizer = createProjectPathAuthorizer();
    authorizer.authorizeFromRecentProjects(JSON.stringify([
      { name: 'Persisted', fileName: 'persisted.layox', filePath: persistedPath, lastOpened: 1 },
    ]));

    expect(await authorizer.resolveAuthorizedPath(persistedPath)).toBe(persistedPath);
    expect(await authorizer.resolveAuthorizedPath(ungrantedPath)).toBeNull();

    await authorizer.authorizePath(grantedPath);
    expect(await authorizer.resolveAuthorizedPath(grantedPath)).toBe(grantedPath);

    expect(authorizer.canPersistRecentProjects(JSON.stringify([
      { name: 'Granted', fileName: 'granted.layox', filePath: grantedPath, lastOpened: 2 },
      { name: 'WebOnly', fileName: 'web.layox', lastOpened: 1 },
    ]))).toBe(true);
    expect(authorizer.canPersistRecentProjects(JSON.stringify([
      { name: 'Injected', fileName: 'ungranted.layox', filePath: ungrantedPath, lastOpened: 3 },
    ]))).toBe(false);
    expect(extractRecentProjectPaths('not-json')).toBeNull();
    expect(isValidProjectPath('/tmp/valid.layox')).toBe(true);
  });

  it('refuses to read or overwrite symbolic links', async () => {
    const directory = await createTempDir();
    const realTarget = path.join(directory, 'secret.txt');
    const symlinkProject = path.join(directory, 'link.layox');
    const regularProject = path.join(directory, 'real.layox');
    await writeFile(realTarget, 'top-secret');
    await writeFile(regularProject, 'PK\x03\x04');
    await symlink(realTarget, symlinkProject);

    await expect(readRegularProjectFile(symlinkProject)).rejects.toThrow('symbolic link');
    await expect(assertTargetNotSymlink(symlinkProject)).rejects.toThrow('symbolic link');

    const content = await readRegularProjectFile(regularProject);
    expect(content.toString()).toBe('PK\x03\x04');
    await expect(assertTargetNotSymlink(regularProject)).resolves.toBeUndefined();
    await expect(assertTargetNotSymlink(path.join(directory, 'new.layox'))).resolves.toBeUndefined();
  });
});
