import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

let mainWindow = null;
let storeFilePath = null;
let storageCache = {};

if (process.env.LAYOX_E2E) {
  globalThis.__layoxE2E = { failNextAtomicSave: false };
}

function isValidProjectPath(filePath) {
  return typeof filePath === 'string' && path.isAbsolute(filePath) && filePath.toLowerCase().endsWith('.layox');
}

function isValidSavePayload(payload) {
  return Boolean(
    payload &&
      typeof payload.name === 'string' &&
      payload.name.length > 0 &&
      payload.name.length <= 255 &&
      payload.name.toLowerCase().endsWith('.layox') &&
      payload.data instanceof ArrayBuffer &&
      (payload.targetPath === undefined || payload.targetPath === null || isValidProjectPath(payload.targetPath)),
  );
}

async function writeFileAtomically(targetPath, data) {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, toBuffer(data), { flag: 'wx' });
    if (process.env.LAYOX_E2E && globalThis.__layoxE2E?.failNextAtomicSave) {
      globalThis.__layoxE2E.failNextAtomicSave = false;
      throw new Error('simulated atomic failure');
    }
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function toBuffer(arrayBuffer) {
  return Buffer.from(arrayBuffer);
}

function ensureStorePath() {
  if (storeFilePath) return storeFilePath;
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });
  storeFilePath = path.join(userDataDir, 'layox-settings.json');
  return storeFilePath;
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
    if (parsed && typeof parsed === 'object') {
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
  writeFileSync(resolvedPath, JSON.stringify(storageCache, null, 2), 'utf-8');
}

function createWindow() {
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
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (currentUrl && new URL(targetUrl).origin === new URL(currentUrl).origin) return;
    event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const devServerUrl = process.env.LAYOX_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function registerIpcHandlers() {
  loadStorageCache();

  ipcMain.handle(IPC_CHANNELS.openProject, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Layox Project',
      filters: [{ name: 'Layox Project', extensions: ['layox'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const fileData = await fs.readFile(filePath);
    return {
      name: path.basename(filePath),
      data: toArrayBuffer(fileData),
      filePath,
    };
  });

  ipcMain.handle(IPC_CHANNELS.openProjectFromPath, async (_event, filePath) => {
    if (!isValidProjectPath(filePath)) return null;
    try {
      const fileData = await fs.readFile(filePath);
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
    if (typeof key !== 'string') return null;
    event.returnValue = storageCache[key] ?? null;
  });

  ipcMain.on(IPC_CHANNELS.storageSet, (event, key, value) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
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
    if (typeof key !== 'string') {
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
