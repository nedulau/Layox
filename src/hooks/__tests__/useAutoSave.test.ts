import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from '../useAutoSave';

const store = vi.hoisted(() => ({
  state: {
    projectSession: 1, isDirty: true, isSaving: false,
    projectLocation: { kind: 'native-path', filePath: '/tmp/project.layox' },
    saveCurrentProject: vi.fn(),
  },
}));
vi.mock('../../store/useProjectStore', () => ({ default: { getState: () => store.state } }));

describe('auto-save session safety', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.state = { ...store.state, projectSession: 1, isDirty: true, isSaving: false };
    store.state.saveCurrentProject.mockReset().mockResolvedValue({ status: 'saved' });
  });
  afterEach(() => vi.useRealTimers());

  it.each([false, true])('only saves the session covered by its recovery point (changed: %s)', async (changeSession) => {
    let finishSnapshot!: () => void;
    const createRecoveryPoint = vi.fn(() => new Promise<void>((resolve) => { finishSnapshot = resolve; }));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    renderHook(() => useAutoSave({ enabled: true, intervalSeconds: 10, createRecoveryPoint, onSuccess, onError }));
    act(() => { vi.advanceTimersByTime(10_000); });
    if (changeSession) store.state = { ...store.state, projectSession: 2 };
    await act(async () => { finishSnapshot(); });
    expect(store.state.saveCurrentProject).toHaveBeenCalledTimes(changeSession ? 0 : 1);
    expect(onSuccess).toHaveBeenCalledTimes(changeSession ? 0 : 1);
    expect(onError).not.toHaveBeenCalled();
  });
});
