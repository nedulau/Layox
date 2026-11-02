import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectLoadCoordinator } from '../projectLoadCoordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('project load coordination', () => {
  let state = { projectSession: 1, revision: 0, showEditor: true };
  beforeEach(() => { state = { projectSession: 1, revision: 0, showEditor: true }; });

  it('applies the latest request even when an earlier request finishes last', async () => {
    const load = createProjectLoadCoordinator(() => state);
    const older = deferred<string>();
    const apply = vi.fn();
    const pending = load(() => older.promise, apply);
    expect(await load(async () => 'newer', apply)).toBe(true);
    older.resolve('older');
    expect(await pending).toBe(false);
    expect(apply.mock.calls).toEqual([['newer']]);
  });

  it.each(['projectSession', 'revision', 'showEditor'] as const)(
    'preserves the current project when %s changes during loading', async (field) => {
      const load = createProjectLoadCoordinator(() => state);
      const source = deferred<string>();
      const apply = vi.fn();
      const pending = load(() => source.promise, apply);
      state = { ...state, [field]: field === 'showEditor' ? false : state[field] + 1 };
      source.resolve('stale');
      expect(await pending).toBe(false);
      expect(apply).not.toHaveBeenCalled();
    },
  );

  it('preserves the current project if the latest picker is cancelled', async () => {
    const load = createProjectLoadCoordinator(() => state);
    const source = deferred<string>();
    const apply = vi.fn();
    const pending = load(() => source.promise, apply);
    expect(await load(async () => null, apply)).toBe(false);
    source.resolve('stale');
    expect(await pending).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it('reports a current failure and ignores errors from an old session', async () => {
    const load = createProjectLoadCoordinator(() => state);
    const apply = vi.fn();
    await expect(load(async () => { throw new Error('corrupt archive'); }, apply)).rejects.toThrow('corrupt');
    const source = deferred<string>();
    const pending = load(() => source.promise, apply);
    state = { ...state, projectSession: 2 };
    source.reject(new Error('old failure'));
    expect(await pending).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});
