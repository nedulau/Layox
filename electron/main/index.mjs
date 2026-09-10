import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @typedef {{ name: string, data: ArrayBuffer, targetPath?: string | null }} SaveProjectPayload */
/** @typedef {{ failNextAtomicSave: boolean }} E2EState */

const IPC_CHANNELS = {
  openProject: 'layox:open-project',
  openProjectFromPath: 'layox:open-project-from-path',
  saveProject: 'layox:save-project',
  saveProjectAs: 'layox:save-project-as',
  storageGet: 'layox:storage:get',
  storageSet: 'layox:storage:set',
  storageRemove: 'layox:storage:remove',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WINDOW_WIDTH = 1500;
const WINDOW_HEIGHT = 980;
const MAX_PROJECT_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_STORAGE_KEY_LENGTH = 128;
const MAX_STORAGE_VALUE_BYTES = 1024 * 1024;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {string | null} */
let storeFilePath = null;
/** @type {Record<string, string>} */
let storageCache = {};

function getE2EState() {
  return /** @type {typeof globalThis & { __layoxE2E?: E2EState }} */ (globalThis).__layoxE2E;
}

if (process.env.LAYOX_E2E) {
  /** @type {typeof globalThis & { __layoxE2E?: E2EState }} */ (globalThis).__layoxE2E = {
    failNextAtomicSave: false,
  };
}

/** @param {unknown} filePath */
function isValidProjectPath(filePath) {
  return typeof filePath === 'string' && path.isAbsolute(filePath) && filePath.toLowerCase().endsWith('.layox');
}

/**
 * @param {unknown} payload
 * @returns {payload is SaveProjectPayload}
 */
function isValidSavePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = /** @type {Partial<SaveProjectPayload>} */ (payload);
  return Boolean(
    typeof candidate.name === 'string' &&
      candidate.name.length > 0 &&
      candidate.name.length <= 255 &&
      candidate.name.toLowerCase().endsWith('.layox') &&
      candidate.data instanceof ArrayBuffer &&
      candidate.data.byteLength > 0 &&
      candidate.data.byteLength <= MAX_PROJECT_ARCHIVE_BYTES &&
      (candidate.targetPath === undefined || candidate.targetPath === null || isValidProjectPath(candidate.targetPath)),
  );
}

/** @param {unknown} key */
function isValidStorageKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_STORAGE_KEY_LENGTH;
}

/** @param {unknown} value */
function isValidStorageValue(value) {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_STORAGE_VALUE_BYTES;
}

/** @param {Electron.IpcMainEvent | Electron.IpcMainInvokeEvent} event */
function isTrustedIpcSender(event) {
  return Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      event.sender === mainWindow.webContents &&
      event.senderFrame === mainWindow.webContents.mainFrame,
  );
}

function resolveDevServerUrl() {
  const configuredUrl = process.env.LAYOX_DEV_SERVER_URL;
  if (!configuredUrl) return null;
  if (app.isPackaged) throw new Error('LAYOX_DEV_SERVER_URL is disabled in packaged builds.');

  const parsedUrl = new URL(configuredUrl);
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (parsedUrl.protocol !== 'http:' || !allowedHosts.has(parsedUrl.hostname) || parsedUrl.username || parsedUrl.password) {
    throw new Error('LAYOX_DEV_SERVER_URL must use HTTP on a loopback host.');
  }
  return parsedUrl;
}

/** @param {string} targetUrl @param {URL} entryUrl */
function isAllowedRendererUrl(targetUrl, entryUrl) {
  try {
    const candidate = new URL(targetUrl);
    if (entryUrl.protocol === 'file:') {
      return candidate.protocol === 'file:' &&
        candidate.pathname === entryUrl.pathname &&
        candidate.search === entryUrl.search;
    }
    return candidate.origin === entryUrl.origin;
  } catch {
    return false;
  }
}

/** @param {string} targetPath @param {ArrayBuffer} data */
async function writeFileAtomically(targetPath, data) {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, toBuffer(data), { flag: 'wx' });
    const e2eState = getE2EState();
    if (process.env.LAYOX_E2E && e2eState?.failNextAtomicSave) {
      e2eState.failNextAtomicSave = false;
      throw new Error('simulated atomic failure');
    }
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

/** @param {string} filePath */
async function readProjectFile(filePath) {
  const fileStats = await fs.stat(filePath);
  if (!fileStats.isFile() || fileStats.size <= 0 || fileStats.size > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new Error('The selected Layox project has an invalid file size.');
  }
  return fs.readFile(filePath);
}

/** @param {Buffer} buffer */
function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/** @param {ArrayBuffer} arrayBuffer */
function toBuffer(arrayBuffer) {
  return Buffer.from(arrayBuffer);
}

function ensureStorePath() {
  if (storeFilePath) return storeFilePath;
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
  storeFilePath = path.join(userDataDir, 'layox-settings.json');
  return storeFilePath;
}

/** @param {unknown} value @returns {value is Record<string, string>} */
function isStringRecord(value) {
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value)
      && Object.values(value).every((entry) => typeof entry === 'string'),
  );
}

function loadStorageCache() {
  try {
    const resolvedPath = ensureStorePath();
    if (!existsSync(resolvedPath)) {
      storageCache = {};
      return;
    }
    const raw = readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (isStringRecord(parsed)) {
      storageCache = parsed;
      return;
    }
    storageCache = {};
  } catch {
    storageCache = {};
  }
}

function persistStorageCache() {
  const resolvedPath = ensureStorePath();
  writeFileSync(resolvedPath, JSON.stringify(storageCache, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

function createWindow() {
  const devServerUrl = resolveDevServerUrl();
  const rendererEntryUrl = devServerUrl ?? pathToFileURL(path.join(__dirname, '../../dist/index.html'));

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (isAllowedRendererUrl(targetUrl, rendererEntryUrl)) return;
    event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl.href);
  } else {
    mainWindow.loadURL(rendererEntryUrl.href);
  }
}

function registerIpcHandlers() {
  loadStorageCache();

  ipcMain.handle(IPC_CHANNELS.openProject, async (event) => {
    if (!isTrustedIpcSender(event)) return null;
    const result = await dialog.showOpenDialog({
      title: 'Open Layox Project',
      filters: [{ name: 'Layox Project', extensions: ['layox'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const fileData = await readProjectFile(filePath);
    return {
      name: path.basename(filePath),
      data: toArrayBuffer(fileData),
      filePath,
    };
  });

  ipcMain.handle(IPC_CHANNELS.openProjectFromPath, async (_event, filePath) => {
    if (!isTrustedIpcSender(_event)) return null;
    if (!isValidProjectPath(filePath)) return null;
    try {
      const fileData = await readProjectFile(filePath);
      return {
        name: path.basename(filePath),
        data: toArrayBuffer(fileData),
        filePath,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.saveProject, async (_event, payload) => {
    if (!isTrustedIpcSender(_event)) return null;
    if (!isValidSavePayload(payload)) return null;

    let targetPath = isValidProjectPath(payload.targetPath) ? payload.targetPath : null;
    if (!targetPath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Layox Project',
        defaultPath: payload.name,
        filters: [{ name: 'Layox Project', extensions: ['layox'] }],
      });
      if (result.canceled || !result.filePath) return null;
      targetPath = result.filePath;
    }

    await writeFileAtomically(targetPath, payload.data);
    return { name: path.basename(targetPath), filePath: targetPath };
  });

  ipcMain.handle(IPC_CHANNELS.saveProjectAs, async (_event, payload) => {
    if (!isTrustedIpcSender(_event)) return null;
    if (!isValidSavePayload(payload)) return null;

    const result = await dialog.showSaveDialog({
      title: 'Save Layox Project As',
      defaultPath: payload.name,
      filters: [{ name: 'Layox Project', extensions: ['layox'] }],
    });

    if (result.canceled || !result.filePath) return null;

    await writeFileAtomically(result.filePath, payload.data);
    return { name: path.basename(result.filePath), filePath: result.filePath };
  });

  ipcMain.on(IPC_CHANNELS.storageGet, (event, key) => {
    if (!isTrustedIpcSender(event) || !isValidStorageKey(key)) {
      event.returnValue = null;
      return;
    }
    event.returnValue = storageCache[key] ?? null;
  });

  ipcMain.on(IPC_CHANNELS.storageSet, (event, key, value) => {
    if (!isTrustedIpcSender(event) || !isValidStorageKey(key) || !isValidStorageValue(value)) {
      event.returnValue = false;
      return;
    }

    storageCache[key] = value;
    try {
      persistStorageCache();
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on(IPC_CHANNELS.storageRemove, (event, key) => {
    if (!isTrustedIpcSender(event) || !isValidStorageKey(key)) {
      event.returnValue = false;
      return;
    }

    delete storageCache[key];
    try {
      persistStorageCache();
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
