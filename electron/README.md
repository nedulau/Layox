# Electron Bootstrap (Linux First)

This folder contains the supported Linux desktop shell.

## Included

- main process: electron/main/index.mjs
- sandbox-compatible CommonJS preload bridge: electron/preload/index.cjs

Both expose the same channel names as src/infra/electron/ipcContract.ts:

- layox:open-project
- layox:open-project-from-path
- layox:save-project
- layox:save-project-as
- layox:storage:get
- layox:storage:set
- layox:storage:remove

## Notes

- Renderer stays sandboxed (contextIsolation true, nodeIntegration false, sandbox true).
- Storage now persists to a JSON file at app.getPath('userData')/layox-settings.json.
- Foreign navigation, new windows, and permission requests are denied by default.
- The preload exposes only the allow-listed project and settings methods, never raw `ipcRenderer`.
- IPC payloads, paths, file names, and data types are validated in the main process.
- Save/Open supports `.layox` files via native dialogs.
- Opened/saved paths are returned to the renderer: `Ctrl+S` overwrites in place and `Ctrl+Shift+S` always opens Save As.
- Saves write a temporary file in the destination directory and atomically rename it. A failed rename leaves the previous project intact and removes the temporary file.

## Development

1) Start renderer:

```bash
npm run electron:dev:renderer
```

2) Start desktop shell (in a second terminal):

```bash
npm run electron:dev:desktop
```

3) Run desktop shell against built app:

```bash
npm run build:electron:renderer
npm run electron:start
```

## Linux AppImage packaging

Build a Linux AppImage artifact from project root:

```bash
npm run electron:build:appimage
```

Output artifacts are written to `dist-electron/`.
Automated CI build and artifact upload are configured in `.github/workflows/appimage.yml`.

Quick local smoke test:

```bash
./dist-electron/*.AppImage
```

Desktop end-to-end coverage can be run with:

```bash
npm run test:e2e:electron
```

CI runs this under Xvfb and then starts the packaged AppImage as a separate smoke test.
