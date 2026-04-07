import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  openProject: 'layox:open-project',
  saveProject: 'layox:save-project',
  saveProjectAs: 'layox:save-project-as',
  storageGet: 'layox:storage:get',
  storageSet: 'layox:storage:set',
  storageRemove: 'layox:storage:remove',
};

contextBridge.exposeInMainWorld('electronBridge', {
  openProject: () => ipcRenderer.invoke(IPC_CHANNELS.openProject),
  saveProject: (payload) => ipcRenderer.invoke(IPC_CHANNELS.saveProject, payload),
  saveProjectAs: (payload) => ipcRenderer.invoke(IPC_CHANNELS.saveProjectAs, payload),
  storage: {
    getItem: (key) => ipcRenderer.invoke(IPC_CHANNELS.storageGet, key),
    setItem: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.storageSet, key, value),
    removeItem: (key) => ipcRenderer.invoke(IPC_CHANNELS.storageRemove, key),
  },
});
