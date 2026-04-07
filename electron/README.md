# Electron Bootstrap (Linux First)

This folder contains runnable bootstrap stubs for the desktop target.

## Included

- main process: electron/main/index.mjs
- preload bridge: electron/preload/index.mjs

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
- Save/Open currently supports .layox files via native dialogs.

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
npm run build
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
