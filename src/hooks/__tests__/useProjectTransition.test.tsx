import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveOutcome } from '../../infra/ports/fileSystemPort';
import { useProjectTransition } from '../useProjectTransition';

const store = vi.hoisted(() => ({
  state: { isDirty: true, projectSession: 1, saveCurrentProject: vi.fn<() => Promise<SaveOutcome>>() },
}));
vi.mock('../../store/useProjectStore', () => ({ default: { getState: () => store.state } }));

beforeEach(() => {
  store.state.isDirty = true;
  store.state.projectSession = 1;
  store.state.saveCurrentProject.mockReset();
});

describe('useProjectTransition', () => {
  it('continues immediately when clean and supports cancelling or discarding when dirty', () => {
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition);
    act(() => result.current.requestTransition(action));
    expect(action).not.toHaveBeenCalled();
    act(() => result.current.cancelTransition());
    expect(result.current.isPending).toBe(false);
    act(() => result.current.requestTransition(action));
    act(() => result.current.discardAndTransition());
    expect(action).toHaveBeenCalledOnce();
    store.state.isDirty = false;
    act(() => result.current.requestTransition(action));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it.each<SaveOutcome>([{ status: 'cancelled' }, { status: 'downloaded' }])(
    'keeps the current project after cancellation or edits during saving: %s', async (outcome) => {
      const action = vi.fn();
      store.state.saveCurrentProject.mockResolvedValueOnce(outcome);
      const { result } = renderHook(useProjectTransition);
      act(() => result.current.requestTransition(action));
      await act(() => result.current.saveAndTransition());
      expect(action).not.toHaveBeenCalled();
      expect(result.current.isPending).toBe(true);
    },
  );

  it('continues after a successful save and blocks discard and cancel while saving', async () => {
    let finish!: (outcome: SaveOutcome) => void;
    store.state.saveCurrentProject.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition);
    act(() => result.current.requestTransition(action));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveAndTransition(); });
    act(() => { result.current.cancelTransition(); result.current.discardAndTransition(); });
    expect(result.current.isPending).toBe(true);
    expect(action).not.toHaveBeenCalled();
    store.state.isDirty = false;
    await act(async () => { finish({ status: 'downloaded' }); await saving; });
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isPending).toBe(false);
  });

  it('shows a save error, keeps the project, and permits retry', async () => {
    const action = vi.fn();
    store.state.saveCurrentProject.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(useProjectTransition);
    act(() => result.current.requestTransition(action));
    await act(() => result.current.saveAndTransition());
    expect(result.current.saveError).toBe('disk full');
    expect(result.current.isPending).toBe(true);
    expect(action).not.toHaveBeenCalled();
    store.state.saveCurrentProject.mockImplementationOnce(async () => {
      store.state.isDirty = false;
      return { status: 'downloaded' };
    });
    await act(() => result.current.saveAndTransition());
    expect(action).toHaveBeenCalledOnce();
  });

  it('ignores a pending transition after the project session changes during saving', async () => {
    let finish!: (outcome: SaveOutcome) => void;
    store.state.saveCurrentProject.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const action = vi.fn();
    const { result } = renderHook(useProjectTransition);
    act(() => result.current.requestTransition(action));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveAndTransition(); });
    store.state.projectSession += 1;
    store.state.isDirty = false;
    await act(async () => { finish({ status: 'downloaded' }); await saving; });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });
});
