# Electron Bootstrap (Linux First)

This folder contains runnable bootstrap stubs for the desktop target.

## Included

- main process: electron/main/index.mjs
- preload bridge: electron/preload/index.mjs

Both expose the same channel names as src/infra/electron/ipcContract.ts:

- layox:open-project
- layox:save-project
- layox:save-project-as
- layox:storage:get
- layox:storage:set
- layox:storage:remove

## Notes

- Renderer stays sandboxed (contextIsolation true, nodeIntegration false, sandbox true).
- Storage in this bootstrap is in-memory only and should be replaced by a persistent store.
- Save/Open currently supports .layox files via native dialogs.

## Next step

Replace in-memory storage with a JSON-backed store in app.getPath('userData') and wire build scripts for packaging.
