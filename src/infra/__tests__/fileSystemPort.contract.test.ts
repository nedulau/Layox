import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../types';
import type { FileSystemFileHandleExt } from '../../types';

vi.mock('../../utils/fileIO', () => ({
  showOpenDialog: vi.fn(),
  saveProject: vi.fn(),
  saveProjectAs: vi.fn(),
}));

import { showOpenDialog, saveProject, saveProjectAs } from '../../utils/fileIO';
import { createWebFileSystemPort } from '../adapters/webFileSystemPort';
import { createElectronFileSystemPort } from '../adapters/electronFileSystemPort';
import { createCapacitorFileSystemPort } from '../adapters/capacitorFileSystemPort';

const projectFixture: Project = {
  meta: {
    name: 'Contract Project',
    version: '1.0',
  },
  pages: [],
};

const fileHandleStub: FileSystemFileHandleExt = {
  kind: 'file',
  name: 'contract.layox',
  getFile: async () => new File([], 'contract.layox'),
  createWritable: async () => {
    throw new Error('Not implemented in contract test');
  },
};

describe('FileSystemPort contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete globalThis.electronBridge;
    delete globalThis.capacitorBridge;
  });

  it('web adapter delegates open and save operations', async () => {
    const file = new File(['demo'], 'demo.layox', { type: 'application/zip' });
    vi.mocked(showOpenDialog).mockResolvedValueOnce({ file, handle: fileHandleStub });
    vi.mocked(saveProject).mockResolvedValueOnce(null);
    vi.mocked(saveProjectAs).mockResolvedValueOnce(null);

    const port = createWebFileSystemPort();
    const opened = await port.openProjectDialog();
    const openedByPath = await port.openProjectFromPath('/tmp/demo.layox');
    await port.saveProject(projectFixture, {}, fileHandleStub);
    await port.saveProjectAs(projectFixture, {});

    expect(opened?.file.name).toBe('demo.layox');
    expect(openedByPath).toBeNull();
    expect(showOpenDialog).toHaveBeenCalledTimes(1);
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(saveProjectAs).toHaveBeenCalledTimes(1);
  });

  it('electron adapter uses bridge when available', async () => {
    const openProject = vi.fn().mockResolvedValue({
      name: 'from-electron.layox',
      data: new TextEncoder().encode('zip-content').buffer,
      filePath: '/tmp/from-electron.layox',
    });
    const openProjectFromPath = vi.fn().mockResolvedValue({
      name: 'from-electron-path.layox',
      data: new TextEncoder().encode('zip-content').buffer,
      filePath: '/tmp/from-electron-path.layox',
    });
    const saveProjectBridge = vi.fn().mockResolvedValue({ name: 'saved.layox' });
    const saveProjectAsBridge = vi.fn().mockResolvedValue({ name: 'saved-as.layox' });

    globalThis.electronBridge = {
      openProject,
      openProjectFromPath,
      saveProject: saveProjectBridge,
      saveProjectAs: saveProjectAsBridge,
    };

    const port = createElectronFileSystemPort();
    const opened = await port.openProjectDialog();
    const openedByPath = await port.openProjectFromPath('/tmp/from-electron-path.layox');
    await port.saveProject(projectFixture, { 'assets/demo.txt': new Blob(['x']) }, fileHandleStub);
    await port.saveProjectAs(projectFixture, { 'assets/demo.txt': new Blob(['x']) });

    expect(opened?.file.name).toBe('from-electron.layox');
    expect(opened?.filePath).toBe('/tmp/from-electron.layox');
    expect(openedByPath?.file.name).toBe('from-electron-path.layox');
    expect(openedByPath?.filePath).toBe('/tmp/from-electron-path.layox');
    expect(openProject).toHaveBeenCalledTimes(1);
    expect(openProjectFromPath).toHaveBeenCalledTimes(1);
    expect(saveProjectBridge).toHaveBeenCalledTimes(1);
    expect(saveProjectAsBridge).toHaveBeenCalledTimes(1);
    expect(showOpenDialog).not.toHaveBeenCalled();
  });

  it('capacitor adapter uses bridge when available', async () => {
    const openProject = vi.fn().mockResolvedValue({
      name: 'from-capacitor.layox',
      data: new TextEncoder().encode('zip-content').buffer,
      filePath: '/tmp/from-capacitor.layox',
    });
    const openProjectFromPath = vi.fn().mockResolvedValue({
      name: 'from-capacitor-path.layox',
      data: new TextEncoder().encode('zip-content').buffer,
      filePath: '/tmp/from-capacitor-path.layox',
    });
    const saveProjectBridge = vi.fn().mockResolvedValue({ name: 'saved.layox' });
    const saveProjectAsBridge = vi.fn().mockResolvedValue({ name: 'saved-as.layox' });

    globalThis.capacitorBridge = {
      openProject,
      openProjectFromPath,
      saveProject: saveProjectBridge,
      saveProjectAs: saveProjectAsBridge,
    };

    const port = createCapacitorFileSystemPort();
    const opened = await port.openProjectDialog();
    const openedByPath = await port.openProjectFromPath('/tmp/from-capacitor-path.layox');
    await port.saveProject(projectFixture, { 'assets/demo.txt': new Blob(['x']) }, fileHandleStub);
    await port.saveProjectAs(projectFixture, { 'assets/demo.txt': new Blob(['x']) });

    expect(opened?.file.name).toBe('from-capacitor.layox');
    expect(opened?.filePath).toBe('/tmp/from-capacitor.layox');
    expect(openedByPath?.file.name).toBe('from-capacitor-path.layox');
    expect(openedByPath?.filePath).toBe('/tmp/from-capacitor-path.layox');
    expect(openProject).toHaveBeenCalledTimes(1);
    expect(openProjectFromPath).toHaveBeenCalledTimes(1);
    expect(saveProjectBridge).toHaveBeenCalledTimes(1);
    expect(saveProjectAsBridge).toHaveBeenCalledTimes(1);
    expect(showOpenDialog).not.toHaveBeenCalled();
  });
});
