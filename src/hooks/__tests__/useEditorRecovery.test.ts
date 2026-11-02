import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoSaveOptions } from '../useAutoSave';
import { useEditorRecovery } from '../useEditorRecovery';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  restoreRecoveryPoint: vi.fn(),
  removeStoredValue: vi.fn(),
  useAutoSave: vi.fn(),
  state: {
    projectSession: 1,
    project: {
      meta: { id: 'project-1', name: 'Album', version: '1.1' },
      pages: [{ id: 'page-1', elements: [] }],
    },
    currentPageIndex: 0,
    assetBlobs: { 'assets/photo.jpg': new Blob(['photo']) },
  },
}));

vi.mock('../../utils/recoveryRepository', () => ({
  recoveryRepository: {
    list: mocks.list,
    save: mocks.save,
  },
}));

vi.mock('../../infra/storage', () => ({
  removeStoredValue: mocks.removeStoredValue,
}));

vi.mock('../../store/useProjectStore', () => ({
  default: {
    getState: () => ({
      ...mocks.state,
      restoreRecoveryPoint: mocks.restoreRecoveryPoint,
    }),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'recovery-id',
}));

vi.mock('../useAutoSave', () => ({
  useAutoSave: mocks.useAutoSave,
}));

const summary = {
  id: 'recovery-id',
  projectId: 'project-1',
  createdAt: 123,
  pageIndex: 0,
  pageCount: 1,
  projectName: 'Album',
};

function getAutoSaveOptions(): AutoSaveOptions {
  const options = mocks.useAutoSave.mock.calls.at(-1)?.[0] as AutoSaveOptions | undefined;
  if (!options) throw new Error('Auto-save options were not registered');
  return options;
}

describe('useEditorRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([summary]);
    mocks.save.mockResolvedValue(undefined);
    mocks.state.projectSession = 1;
    mocks.restoreRecoveryPoint.mockResolvedValue(true);
  });

  it('loads project recovery points and removes the obsolete timeline', async () => {
    const { result } = renderHook(() => useEditorRecovery({
      projectId: 'project-1',
      autoSaveEnabled: true,
      autoSaveInterval: 30,
    }));

    await waitFor(() => expect(result.current.recoveryPoints).toEqual([summary]));

    expect(mocks.removeStoredValue).toHaveBeenCalledWith('layox_autoSaveTimeline');
    expect(mocks.list).toHaveBeenCalledWith('project-1');
    expect(getAutoSaveOptions()).toMatchObject({
      enabled: true,
      intervalSeconds: 30,
    });
  });

  it('creates a complete recovery snapshot and refreshes the list', async () => {
    renderHook(() => useEditorRecovery({
      projectId: 'project-1',
      autoSaveEnabled: true,
      autoSaveInterval: 30,
    }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledOnce());

    await act(async () => {
      await getAutoSaveOptions().createRecoveryPoint();
    });

    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'recovery-id',
        projectId: 'project-1',
        pageIndex: 0,
        pageCount: 1,
        projectName: 'Album',
        project: expect.objectContaining({
          meta: expect.objectContaining({ id: 'project-1' }),
        }),
      }),
      mocks.state.assetBlobs,
    );
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it('restores project data through the store', async () => {
    const { result } = renderHook(() => useEditorRecovery({
      projectId: 'project-1',
      autoSaveEnabled: false,
      autoSaveInterval: 30,
    }));

    let restored = false;
    await act(async () => {
      restored = await result.current.restoreRecoveryPoint(summary);
    });

    expect(restored).toBe(true);
    expect(mocks.restoreRecoveryPoint).toHaveBeenCalledWith('recovery-id');
    expect(result.current.recoveryError).toBeNull();
  });

  it('reports restore failures without changing the project', async () => {
    mocks.restoreRecoveryPoint.mockRejectedValueOnce(new Error('missing asset'));
    const { result } = renderHook(() => useEditorRecovery({
      projectId: 'project-1',
      autoSaveEnabled: false,
      autoSaveInterval: 30,
    }));

    let restored = true;
    await act(async () => {
      restored = await result.current.restoreRecoveryPoint(summary);
    });

    expect(restored).toBe(false);
    expect(result.current.recoveryError).toBe('missing asset');
  });

  it('does not report success for a superseded restore', async () => {
    mocks.restoreRecoveryPoint.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useEditorRecovery({
      projectId: 'project-1', autoSaveEnabled: false, autoSaveInterval: 30,
    }));
    await act(async () => {
      expect(await result.current.restoreRecoveryPoint(summary)).toBe(false);
    });
    expect(result.current.recoveryError).toBeNull();
  });
});
