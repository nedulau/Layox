import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileSystemPort, SaveOutcome } from '../../infra/ports/fileSystemPort';
import type { Project } from '../../types';
import { createSaveCoordinator, type SaveCoordinatorState, type SaveStatePatch } from '../saveCoordinator';

const project: Project = {
  meta: { id: 'project', name: 'Album', version: '1.1' },
  pages: [{ id: 'page', elements: [], background: '#fff' }],
};

const port: FileSystemPort = {
  supportsNativePicker: vi.fn(() => true),
  openProjectDialog: vi.fn(async () => null),
  openProjectFromPath: vi.fn(async () => null),
  saveProject: vi.fn(async (): Promise<SaveOutcome> => ({ status: 'cancelled' })),
  saveProjectAs: vi.fn(async (): Promise<SaveOutcome> => ({ status: 'cancelled' })),
};

describe('saveCoordinator', () => {
  let state: SaveCoordinatorState;
  let patches: SaveStatePatch[];
  const onSavedProject = vi.fn();

  beforeEach(() => {
    state = { project, assetBlobs: {}, projectLocation: null, revision: 3 };
    patches = [];
    onSavedProject.mockReset();
    vi.mocked(port.saveProject).mockReset();
    vi.mocked(port.saveProjectAs).mockReset();
  });

  function coordinator() {
    return createSaveCoordinator({
      fileSystemPort: port,
      getState: () => state,
      updateSaveState: (patch) => {
        patches.push(patch);
        state = { ...state, ...patch };
      },
      onSavedProject,
    });
  }

  it('saves to a native path and marks only the starting revision', async () => {
    vi.mocked(port.saveProject).mockImplementationOnce(async () => {
      state = { ...state, revision: 4 };
      return { status: 'saved', location: { kind: 'native-path', filePath: '/tmp/album.layox' } };
    });

    await coordinator()(false);

    expect(patches.at(-1)).toMatchObject({ savedRevision: 3, isDirty: true, isSaving: false });
    expect(onSavedProject).toHaveBeenCalledWith({
      projectName: 'Album',
      fileName: 'album.layox',
      filePath: '/tmp/album.layox',
    });
  });

  it('uses Save As and reports a web handle name', async () => {
    const handle = {
      kind: 'file' as const,
      name: 'web.layox',
      getFile: async () => new File([], 'web.layox'),
      createWritable: vi.fn(),
    };
    vi.mocked(port.saveProjectAs).mockResolvedValueOnce({
      status: 'saved',
      location: { kind: 'web-handle', handle },
    });

    await coordinator()(true);

    expect(port.saveProjectAs).toHaveBeenCalledWith(project, {});
    expect(onSavedProject).toHaveBeenCalledWith({
      projectName: 'Album',
      fileName: 'web.layox',
      filePath: undefined,
    });
  });

  it('treats a download as saved without retaining a location', async () => {
    vi.mocked(port.saveProject).mockResolvedValueOnce({ status: 'downloaded' });

    await coordinator()(false);

    expect(patches.at(-1)).toMatchObject({
      projectLocation: null,
      savedRevision: 3,
      isDirty: false,
    });
    expect(onSavedProject).not.toHaveBeenCalled();
  });

  it('does not mark a cancelled save as successful', async () => {
    vi.mocked(port.saveProject).mockResolvedValueOnce({ status: 'cancelled' });

    await coordinator()(false);

    expect(patches).toEqual([
      { isSaving: true, saveError: null },
      { isSaving: false },
    ]);
  });

  it('coalesces concurrent in-place saves and permits a later save', async () => {
    let finish: ((outcome: SaveOutcome) => void) | undefined;
    vi.mocked(port.saveProject).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const save = coordinator();

    const first = save(false);
    const second = save(false);
    expect(second).toBe(first);
    finish?.({ status: 'cancelled' });
    await first;

    vi.mocked(port.saveProject).mockResolvedValueOnce({ status: 'cancelled' });
    await save(false);
    expect(port.saveProject).toHaveBeenCalledTimes(2);
  });

  it('queues Save As when an in-place save is still running', async () => {
    let finish: ((outcome: SaveOutcome) => void) | undefined;
    vi.mocked(port.saveProject).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    vi.mocked(port.saveProjectAs).mockResolvedValueOnce({ status: 'cancelled' });
    const save = coordinator();

    const inPlaceSave = save(false);
    const saveAs = save(true);

    expect(saveAs).not.toBe(inPlaceSave);
    expect(port.saveProjectAs).not.toHaveBeenCalled();
    finish?.({ status: 'cancelled' });
    await inPlaceSave;
    await saveAs;

    expect(port.saveProjectAs).toHaveBeenCalledOnce();
  });

  it.each([new Error('disk full'), 'native failure'])('surfaces save failure %s', async (failure) => {
    vi.mocked(port.saveProject).mockRejectedValueOnce(failure);

    await expect(coordinator()(false)).rejects.toBe(failure);

    expect(patches.at(-1)).toEqual({
      isSaving: false,
      saveError: failure instanceof Error ? failure.message : String(failure),
    });
  });

  it('falls back to the project name for a native directory-like path', async () => {
    vi.mocked(port.saveProject).mockResolvedValueOnce({
      status: 'saved',
      location: { kind: 'native-path', filePath: '/' },
    });

    await coordinator()(false);

    expect(onSavedProject).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'Album.layox' }));
  });
});
