import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IPC_CHANNELS = {
  openProject: 'layox:open-project',
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
let currentProjectPath = null;
let storeFilePath = null;
let storageCache = {};

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
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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
    currentProjectPath = filePath;

    return {
      name: path.basename(filePath),
      data: toArrayBuffer(fileData),
    };
  });

  ipcMain.handle(IPC_CHANNELS.saveProject, async (_event, payload) => {
    if (!payload?.data || !payload?.name) return null;

    let targetPath = currentProjectPath;
    if (!targetPath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Layox Project',
        defaultPath: payload.name,
        filters: [{ name: 'Layox Project', extensions: ['layox'] }],
      });
      if (result.canceled || !result.filePath) return null;
      targetPath = result.filePath;
    }

    await fs.writeFile(targetPath, toBuffer(payload.data));
    currentProjectPath = targetPath;

    return { name: path.basename(targetPath) };
  });

  ipcMain.handle(IPC_CHANNELS.saveProjectAs, async (_event, payload) => {
    if (!payload?.data || !payload?.name) return null;

    const result = await dialog.showSaveDialog({
      title: 'Save Layox Project As',
      defaultPath: payload.name,
      filters: [{ name: 'Layox Project', extensions: ['layox'] }],
    });

    if (result.canceled || !result.filePath) return null;

    await fs.writeFile(result.filePath, toBuffer(payload.data));
    currentProjectPath = result.filePath;

    return { name: path.basename(result.filePath) };
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
