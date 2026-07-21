import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Project,
  FileSystemFileHandleExt,
  FileSystemWritableFileStream as LayoxWritableFileStream,
} from '../../types';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

import { saveAs } from 'file-saver';
import { saveProjectAs } from '../fileIO';

const project: Project = {
  meta: { id: 'file-io-project', name: 'File IO', version: '1.1' },
  pages: [{ id: 'page', elements: [], background: '#fff' }],
};

function installSavePicker(value: unknown): void {
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, 'showSaveFilePicker');
  vi.clearAllMocks();
});

describe('web file saving', () => {
  it('does not download when the user cancels Save As', async () => {
    installSavePicker(vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));

    const outcome = await saveProjectAs(project, {});

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('downloads when the native picker is unsupported', async () => {
    const outcome = await saveProjectAs(project, {});

    expect(outcome).toEqual({ status: 'downloaded' });
    expect(saveAs).toHaveBeenCalledOnce();
  });

  it('returns the selected handle after a successful native save', async () => {
    const write = vi.fn();
    const close = vi.fn();
    const handle: FileSystemFileHandleExt = {
      kind: 'file',
      name: 'selected.layox',
      getFile: async () => new File([], 'selected.layox'),
      createWritable: async () => ({ write, close }) as unknown as LayoxWritableFileStream,
    };
    installSavePicker(vi.fn().mockResolvedValue(handle));

    const outcome = await saveProjectAs(project, {});

    expect(outcome).toEqual({ status: 'saved', location: { kind: 'web-handle', handle } });
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(saveAs).not.toHaveBeenCalled();
  });
});
