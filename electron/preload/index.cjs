const { contextBridge, ipcRenderer } = require('electron');

const IPC_CHANNELS = {
  openProject: 'layox:open-project',
  openProjectFromPath: 'layox:open-project-from-path',
  saveProject: 'layox:save-project',
  saveProjectAs: 'layox:save-project-as',
  storageGet: 'layox:storage:get',
  storageSet: 'layox:storage:set',
  storageRemove: 'layox:storage:remove',
};

/** @param {string} filePath */
const openProjectFromPath = (filePath) => ipcRenderer.invoke(IPC_CHANNELS.openProjectFromPath, filePath);

/** @param {{ name: string, data: ArrayBuffer, targetPath?: string | null }} payload */
const saveProject = (payload) => ipcRenderer.invoke(IPC_CHANNELS.saveProject, payload);

/** @param {{ name: string, data: ArrayBuffer, targetPath?: string | null }} payload */
const saveProjectAs = (payload) => ipcRenderer.invoke(IPC_CHANNELS.saveProjectAs, payload);

/** @param {string} key */
const getItem = (key) => ipcRenderer.sendSync(IPC_CHANNELS.storageGet, key);

/** @param {string} key @param {string} value */
const setItem = (key, value) => {
  ipcRenderer.sendSync(IPC_CHANNELS.storageSet, key, value);
};

/** @param {string} key */
const removeItem = (key) => {
  ipcRenderer.sendSync(IPC_CHANNELS.storageRemove, key);
};

contextBridge.exposeInMainWorld('electronBridge', {
  openProject: () => ipcRenderer.invoke(IPC_CHANNELS.openProject),
  openProjectFromPath,
  saveProject,
  saveProjectAs,
  storage: {
    getItem,
    setItem,
    removeItem,
  },
});
