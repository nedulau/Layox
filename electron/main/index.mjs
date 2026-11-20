import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertTargetNotSymlink,
  createEmptyStorageCache,
  createProjectPathAuthorizer,
  getStorageEntry,
  isValidProjectPath,
  isValidSavePayload,
  isValidStorageKey,
  isValidStorageValue,
  readRegularProjectFile,
  RECENT_PROJECTS_STORAGE_KEY,
  sanitizeStorageRecord,
} from './security.mjs';

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

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {string | null} */
let storeFilePath = null;
/** @type {Record<string, string>} */
let storageCache = createEmptyStorageCache();
const pathAuthorizer = createProjectPathAuthorizer();

function getE2EState() {
  return /** @type {typeof globalThis & { __layoxE2E?: E2EState }} */ (globalThis).__layoxE2E;
}

if (process.env.LAYOX_E2E) {
  /** @type {typeof globalThis & { __layoxE2E?: E2EState }} */ (globalThis).__layoxE2E = {
    failNextAtomicSave: false,
  };
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
  await assertTargetNotSymlink(targetPath);
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

function loadStorageCache() {
  try {
    const resolvedPath = ensureStorePath();
    if (!existsSync(resolvedPath)) {
      storageCache = createEmptyStorageCache();
      return;
    }
    const raw = readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    storageCache = sanitizeStorageRecord(parsed);
    pathAuthorizer.authorizeFromRecentProjects(
      getStorageEntry(storageCache, RECENT_PROJECTS_STORAGE_KEY),
    );
  } catch {
    storageCache = createEmptyStorageCache();
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
  mainWindow.on('closed', () => {
    mainWindow = null;
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
    const fileData = await readRegularProjectFile(filePath);
    await pathAuthorizer.authorizePath(filePath);
    return {
      name: path.basename(filePath),
      data: toArrayBuffer(fileData),
      filePath,
    };
  });

  ipcMain.handle(IPC_CHANNELS.openProjectFromPath, async (_event, filePath) => {
    if (!isTrustedIpcSender(_event)) return null;
    if (!isValidProjectPath(filePath)) return null;
    const authorizedPath = await pathAuthorizer.resolveAuthorizedPath(filePath);
    if (!authorizedPath) return null;
    try {
      const fileData = await readRegularProjectFile(authorizedPath);
      return {
        name: path.basename(authorizedPath),
        data: toArrayBuffer(fileData),
        filePath: authorizedPath,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.saveProject, async (_event, payload) => {
    if (!isTrustedIpcSender(_event)) return null;
    if (!isValidSavePayload(payload)) return null;

    /** @type {string | null} */
    let targetPath;
    if (payload.targetPath !== undefined && payload.targetPath !== null) {
      targetPath = await pathAuthorizer.resolveAuthorizedPath(payload.targetPath);
      if (!targetPath) return null;
    } else {
      const result = await dialog.showSaveDialog({
        title: 'Save Layox Project',
        defaultPath: payload.name,
        filters: [{ name: 'Layox Project', extensions: ['layox'] }],
      });
      if (result.canceled || !result.filePath) return null;
      targetPath = result.filePath;
      await pathAuthorizer.authorizePath(targetPath);
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

    await pathAuthorizer.authorizePath(result.filePath);
    await writeFileAtomically(result.filePath, payload.data);
    return { name: path.basename(result.filePath), filePath: result.filePath };
  });

  ipcMain.on(IPC_CHANNELS.storageGet, (event, key) => {
    if (!isTrustedIpcSender(event) || !isValidStorageKey(key)) {
      event.returnValue = null;
      return;
    }
    event.returnValue = getStorageEntry(storageCache, key);
  });

  ipcMain.on(IPC_CHANNELS.storageSet, (event, key, value) => {
    if (!isTrustedIpcSender(event) || !isValidStorageKey(key) || !isValidStorageValue(value)) {
      event.returnValue = false;
      return;
    }
    if (key === RECENT_PROJECTS_STORAGE_KEY && !pathAuthorizer.canPersistRecentProjects(value)) {
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
