export const ELECTRON_IPC_CHANNELS = {
  openProject: 'layox:open-project',
  openProjectFromPath: 'layox:open-project-from-path',
  saveProject: 'layox:save-project',
  saveProjectAs: 'layox:save-project-as',
  storageGet: 'layox:storage:get',
  storageSet: 'layox:storage:set',
  storageRemove: 'layox:storage:remove',
} as const;

export type ElectronIpcChannel = (typeof ELECTRON_IPC_CHANNELS)[keyof typeof ELECTRON_IPC_CHANNELS];

export interface SaveProjectIpcPayload {
  name: string;
  data: ArrayBuffer;
}

export interface OpenProjectIpcResult {
  name: string;
  data: ArrayBuffer;
  filePath?: string;
}

export interface SaveProjectIpcResult {
  name: string;
}
