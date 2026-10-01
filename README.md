# Layox

A local-first, privacy-focused photo album creator. No cloud, no server — everything stays on your device.

> **Full feature overview -> [FEATURES.md](FEATURES.md)**

## Highlights

- **Multi-page projects** with cover pages and chapter structure
- **Flexible layouts** (14 templates) plus free arrangement mode
- **In-slot image editing** with pan, zoom, and free crop
- **Inline text editing** directly on the canvas
- **Export to PDF, PNG, and JPEG**
- **Undo / redo** with history
- **Local and offline-first**: no cloud dependency, `.layox` file format
- **Installable PWA** with full editing on desktop and tablets from 768 px
- **No telemetry or analytics**: project data and recovery snapshots stay local

See the [support matrix](SUPPORT.md) for the exact platform scope. Smartphones can open projects and access recovery, but editing requires a tablet or desktop.

## Tech Stack

- **Vite** + **React** + **TypeScript**
- **react-konva** – Canvas rendering
- **zustand** – State management
- **Tailwind CSS** – UI styling
- **jszip** / **file-saver** / **jspdf** – File handling & export
- **vite-plugin-pwa** – Progressive Web App (Service Worker, Manifest)
- **vitest** + **@testing-library/react** – Tests

## Getting Started

```bash
nvm use
npm install
npm run dev
```

Development and release builds use Node.js 24 LTS (see `.nvmrc` and `package.json#engines`).

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Run Modes

### Development

```bash
npm run dev
```

Starts the Vite dev server with HMR at `http://localhost:5173`. No service worker, no PWA caching.

### Production build and local preview

```bash
npm run build
npm run preview -- --host
```

Builds the optimized production app into `dist/` (including service worker and web app manifest) and starts a local preview server. With `--host`, other devices in your network can access it.

### Linux desktop bootstrap (Electron)

Start renderer and desktop shell in two terminals:

```bash
npm run electron:dev:renderer
npm run electron:dev:desktop
```

Run desktop shell against production build:

```bash
npm run build:electron:renderer
npm run electron:start
```

Build a distributable Linux AppImage:

```bash
npm run electron:build:appimage
```

The artifact is written to `dist-electron/`.
Automated CI build is defined in `.github/workflows/appimage.yml`.

### Experimental mobile bridge (Capacitor)

The app now auto-installs a default Capacitor bridge at startup when running in a native Capacitor runtime. The default bridge currently provides:

- file open via native FilePicker when available (with input fallback)
- file open from known path via Filesystem plugin when available
- file save/save-as via Filesystem plugin when available (save-as can trigger native share)
- storage bridge based on localStorage-compatible behavior

This keeps the same Port contract active while native plugin wiring is added incrementally. Capacitor is experimental and is not a release-gated platform.

### Install as PWA

1. Deploy the production build to a host (for example Vercel, Netlify, Cloudflare Pages). **HTTPS is required** for PWA.
2. Open the app URL in the browser.
3. **iOS (Safari):** Share -> Add to Home Screen
4. **Android (Chrome):** Menu -> Install app
5. **Desktop (Chrome/Edge):** use the install icon in the address bar

An available PWA update is shown in the app. Layox never reloads automatically; while a project has unsaved changes, applying the update is disabled.

### Share in local network (without hosting)

```bash
npm run dev -- --host
```

Vite prints a network URL (for example `http://192.168.1.X:5173`) that devices in the same LAN can open.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run dev -- --host` | Expose dev server to local network |
| `npm run build` | Type-check and production build (including PWA) |
| `npm run build:electron:renderer` | Type-check and build renderer for local Electron/appimage (`file://` safe assets) |
| `npm run preview` | Preview production build locally |
| `npm run preview -- --host` | Expose preview server to local network |
| `npm test` | Run tests (watch mode) |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with enforced core coverage gates |
| `npm run test:ui:coverage` | Run component/hook tests with a ratcheted UI coverage baseline |
| `npm run test:e2e` | Build and run Chromium end-to-end tests |
| `npm run test:e2e:electron` | Build and run Electron end-to-end tests |
| `npm run check` | Lint, coverage tests, web build, and Electron renderer build |
| `npm run audit:ci` | Fail for high or critical dependency advisories |
| `npm run electron:start` | Start Electron shell against built app |
| `npm run electron:dev:renderer` | Start renderer dev server for Electron |
| `npm run electron:dev:desktop` | Start Electron shell against renderer dev server |
| `npm run electron:build:appimage` | Build Linux AppImage artifact into `dist-electron/` |

## Project Structure

```
src/
├── components/
│   ├── canvas/          # Canvas editor and project-scoped image cache
│   ├── common/          # Accessible dialogs and shared UI helpers
│   ├── editor/          # Editor menus and asset library
│   ├── StartScreen.tsx  # Start screen with recent projects and recovery
│   ├── LayoutPicker.tsx # Layout selection dropdown
│   └── CropModal.tsx    # Free crop modal (4 sides + corners)
├── domain/              # Defaults, schema migration, pure project operations
├── hooks/               # Auto-save and responsive behavior
├── infra/               # Web, Electron and experimental Capacitor adapters
├── services/            # Save coordination
├── store/               # Zustand state adapter
├── types/               # TypeScript interfaces
├── utils/
│   ├── projectArchive.ts # Validated .layox archive codec
│   ├── recoveryRepository.ts # IndexedDB recovery snapshots and assets
│   ├── layouts.ts       # 14 layout templates + computation
│   └── exportProject.ts # PDF / PNG / JPEG / ZIP export orchestration
├── App.tsx
└── main.tsx
```

## File Format

Projects are saved as versioned `.layox` files: a ZIP container holding `project.json` and an `assets/` folder. Format 1.2 is written today; unversioned, 1.0 and 1.1 projects are migrated on load. Newer unknown versions, invalid values, missing assets and oversized/corrupt archives are rejected without replacing the open project.

## Persistence and recovery

- `Ctrl+S` overwrites an already opened or saved desktop/file-handle project; `Ctrl+Shift+S` always chooses a new destination.
- New projects are never forced into a save dialog by auto-save.
- Auto-save creates complete IndexedDB recovery snapshots, including referenced image blobs, and also updates an existing project file when possible.
- Up to twelve snapshots per project are retained with deduplicated assets and quota-aware pruning.
- Closing, reloading, or returning home warns only when content is genuinely unsaved.

## Release quality gates

Pull requests, `main`, and releases use the same lint, coverage, build, audit, browser E2E and Electron E2E checks. Linux AppImages are built only after the quality job succeeds and are smoke-tested under Xvfb. The supported beta release baseline is `0.1.0-beta.1`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Page format and print resolution

Choose **Layout → Page format** to set Classic (4:3), A4 landscape, A4 portrait, or square (21 × 21 cm) for the entire album. Slots reflow to the new size. Free elements move proportionally; photos retain their aspect ratio. The change supports undo. Older projects keep the classic 1200 × 900 canvas and its A4 landscape PDF margins. New formats fill their matching PDF page without extra margins.

The export dialog offers 150, 300 and 600 DPI for PDF, PNG, JPEG and image ZIPs and displays the resulting pixel dimensions. Compression controls encoding quality independently of the chosen resolution. Resolution warnings use the chosen DPI. Increasing DPI cannot restore detail missing from an original photo. Format 1.2 stores the selected page format; previous Layox versions reject these files.

## Custom page templates

Open **Layout → Custom page templates**, enter a name, and save the current page. Up to 50 templates (2 MiB total) are kept locally for reuse across projects. Templates retain background, text, cover styling and image geometry, but contain no photos or original file paths. Fixed layout slots start empty; free photos become movable, resizable and rotatable placeholders.

**New page from template** inserts a page after the current one, adapts it to the album format and creates fresh element IDs. Select a free placeholder before inserting a photo from a file or the image library; the photo fits within its bounds without stretching and retains its rotation. Empty placeholders remain editable and are omitted from exports, with an empty-place warning. Page insertion supports undo. Deleting a template requires confirmation and leaves existing pages intact. Templates are stored in the local app/browser profile; clearing app data removes them.

## Image library metadata and navigation

The image library combines filename search, unused-image filtering and landscape/portrait/square/unknown orientation filters. Sort by filename or capture time (oldest/newest). JPEG EXIF `DateTimeOriginal` is read locally; images without that field remain explicitly undated and sort after dated photos. File modification time is never substituted for capture time. EXIF rotation is respected when classifying JPEG orientation. PNG/JPEG dimensions are read from bounded headers where possible; other image types use local decoding. Metadata is cached by image blob and processed in small batches, with lazy image thumbnails.

Each image lists buttons for its actual page/slot/element usages. Clicking one closes the library, opens the page, selects the matching image and fits the canvas. Reusing an image in several places lists each occurrence. All analysis stays local and works again after reopening the original project assets.

## Album spread preview

Open **Album preview** next to the page controls to read the album as facing pages. A leading cover is shown alone on the right, followed by paired pages; an unmatched final page keeps a blank facing side. Albums without a leading cover pair from the first page. The preview starts at the current editor page and respects the chosen page format.

Use arrow buttons, Left/Right, Page Up/Down, Home/End, the spread selector, or horizontal touch swipes. Closing with Escape or Close preserves the editor page and selection. **Open in editor: page …** deliberately returns to that page for editing. Editor editing shortcuts are suspended during preview. Only visible pages are rendered, using the same printable renderer as export; obsolete renders are cancelled and failures are shown. Preview resolution is intended for screen viewing; use export for print output.
