import { constants as fsConstants, promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';

/** @typedef {{ name: string, data: ArrayBuffer, targetPath?: string | null }} SaveProjectPayload */

export const MAX_PROJECT_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_STORAGE_KEY_LENGTH = 128;
export const MAX_STORAGE_VALUE_BYTES = 1024 * 1024;
export const RECENT_PROJECTS_STORAGE_KEY = 'layox_recentProjects';

const FORBIDDEN_STORAGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** @param {string} value */
export function hasControlCharacters(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** @param {unknown} filePath @returns {filePath is string} */
export function isValidProjectPath(filePath) {
  return typeof filePath === 'string'
    && filePath.length > 0
    && !hasControlCharacters(filePath)
    && path.isAbsolute(filePath)
    && filePath.toLowerCase().endsWith('.layox');
}

/** @param {unknown} name @returns {name is string} */
export function isValidProjectFileName(name) {
  return typeof name === 'string'
    && name.length > 0
    && name.length <= 255
    && name.toLowerCase().endsWith('.layox')
    && path.basename(name) === name
    && !name.includes('/')
    && !name.includes('\\')
    && !name.includes('..')
    && !hasControlCharacters(name);
}

/** @param {unknown} payload @returns {payload is SaveProjectPayload} */
export function isValidSavePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = /** @type {Partial<SaveProjectPayload>} */ (payload);
  return Boolean(
    isValidProjectFileName(candidate.name)
      && candidate.data instanceof ArrayBuffer
      && candidate.data.byteLength > 0
      && candidate.data.byteLength <= MAX_PROJECT_ARCHIVE_BYTES
      && (candidate.targetPath === undefined || candidate.targetPath === null || isValidProjectPath(candidate.targetPath)),
  );
}

/** @param {unknown} key @returns {key is string} */
export function isValidStorageKey(key) {
  return typeof key === 'string'
    && key.length > 0
    && key.length <= MAX_STORAGE_KEY_LENGTH
    && !FORBIDDEN_STORAGE_KEYS.has(key)
    && !hasControlCharacters(key);
}

/** @param {unknown} value @returns {value is string} */
export function isValidStorageValue(value) {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_STORAGE_VALUE_BYTES;
}

/** @returns {Record<string, string>} */
export function createEmptyStorageCache() {
  return /** @type {Record<string, string>} */ (Object.create(null));
}

/** @param {unknown} value @returns {Record<string, string>} */
export function sanitizeStorageRecord(value) {
  const sanitized = createEmptyStorageCache();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return sanitized;
  for (const [key, entry] of Object.entries(value)) {
    if (isValidStorageKey(key) && isValidStorageValue(entry)) {
      sanitized[key] = entry;
    }
  }
  return sanitized;
}

/** @param {Record<string, string>} cache @param {string} key @returns {string | null} */
export function getStorageEntry(cache, key) {
  return Object.hasOwn(cache, key) ? cache[key] : null;
}

/** @param {string} rawValue @returns {string[] | null} */
export function extractRecentProjectPaths(rawValue) {
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  /** @type {string[]} */
  const paths = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const candidate = /** @type {{ filePath?: unknown }} */ (entry).filePath;
    if (candidate === undefined) continue;
    if (!isValidProjectPath(candidate)) return null;
    paths.push(candidate);
  }
  return paths;
}

/** @param {string} filePath */
export async function assertTargetNotSymlink(filePath) {
  try {
    const existingStats = await fs.lstat(filePath);
    if (!existingStats.isFile()) {
      throw new Error('Refusing to overwrite a symbolic link or non-regular file.');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

/** @param {string} filePath */
export async function readRegularProjectFile(filePath) {
  const linkStats = await fs.lstat(filePath);
  if (!linkStats.isFile()) {
    throw new Error('Refusing to open a symbolic link or non-regular file.');
  }

  const openFlags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const fileHandle = await fs.open(filePath, openFlags);
  try {
    const fileStats = await fileHandle.stat();
    if (!fileStats.isFile() || fileStats.size <= 0 || fileStats.size > MAX_PROJECT_ARCHIVE_BYTES) {
      throw new Error('The selected Layox project has an invalid file size.');
    }
    return await fileHandle.readFile();
  } finally {
    await fileHandle.close();
  }
}

export function createProjectPathAuthorizer() {
  /** @type {Set<string>} */
  const authorizedPaths = new Set();

  /** @param {string} filePath */
  const canonicalizePath = async (filePath) => {
    if (!isValidProjectPath(filePath)) return null;
    const resolvedPath = path.resolve(filePath);
    const canonicalDirectory = await fs.realpath(path.dirname(resolvedPath));
    return path.join(canonicalDirectory, path.basename(resolvedPath));
  };

  /** @param {string} filePath */
  const canonicalizePathSync = (filePath) => {
    if (!isValidProjectPath(filePath)) return null;
    const resolvedPath = path.resolve(filePath);
    try {
      const canonicalDirectory = realpathSync(path.dirname(resolvedPath));
      return path.join(canonicalDirectory, path.basename(resolvedPath));
    } catch {
      return resolvedPath;
    }
  };

  return {
    /** @param {string} filePath */
    async authorizePath(filePath) {
      if (!isValidProjectPath(filePath)) return null;
      const resolvedPath = path.resolve(filePath);
      authorizedPaths.add(resolvedPath);
      try {
        const canonicalPath = await canonicalizePath(resolvedPath);
        if (canonicalPath) {
          authorizedPaths.add(canonicalPath);
          return canonicalPath;
        }
      } catch {
        // Keep normalized path authorized if directory resolution is deferred.
      }
      return resolvedPath;
    },

    /** @param {string | null} rawRecentProjects */
    authorizeFromRecentProjects(rawRecentProjects) {
      if (!rawRecentProjects) return;
      const paths = extractRecentProjectPaths(rawRecentProjects);
      if (!paths) return;
      for (const filePath of paths) {
        const resolvedPath = path.resolve(filePath);
        authorizedPaths.add(resolvedPath);
        const canonicalPath = canonicalizePathSync(resolvedPath);
        if (canonicalPath) authorizedPaths.add(canonicalPath);
      }
    },

    /** @param {string} filePath */
    async resolveAuthorizedPath(filePath) {
      if (!isValidProjectPath(filePath)) return null;
      const resolvedPath = path.resolve(filePath);
      let canonicalPath;
      try {
        canonicalPath = await canonicalizePath(resolvedPath);
      } catch {
        return null;
      }
      if (!canonicalPath) return null;
      if (!authorizedPaths.has(canonicalPath) && !authorizedPaths.has(resolvedPath)) {
        return null;
      }
      return canonicalPath;
    },

    /** @param {string} rawRecentProjects */
    canPersistRecentProjects(rawRecentProjects) {
      const paths = extractRecentProjectPaths(rawRecentProjects);
      if (!paths) return false;
      return paths.every((filePath) => {
        const resolvedPath = path.resolve(filePath);
        if (authorizedPaths.has(resolvedPath)) return true;
        const canonicalPath = canonicalizePathSync(resolvedPath);
        return Boolean(canonicalPath && authorizedPaths.has(canonicalPath));
      });
    },
  };
}
