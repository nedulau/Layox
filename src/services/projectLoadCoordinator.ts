interface ProjectLoadState {
  projectSession: number;
  revision: number;
  showEditor: boolean;
}

/** Applies only the latest load while its original project is still unchanged. */
export function createProjectLoadCoordinator(getState: () => ProjectLoadState) {
  let latestRequest = 0;

  return async <T>(load: () => Promise<T | null>, apply: (value: T) => void): Promise<boolean> => {
    const request = ++latestRequest;
    const initial = getState();
    const isCurrent = () => {
      const current = getState();
      return request === latestRequest
        && current.projectSession === initial.projectSession
        && current.revision === initial.revision
        && current.showEditor === initial.showEditor;
    };

    let value: T | null;
    try {
      value = await load();
    } catch (error) {
      if (!isCurrent()) return false;
      throw error;
    }
    if (value === null || !isCurrent()) return false;
    apply(value);
    return true;
  };
}
