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
- **Installable PWA** for desktop and mobile

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
npm install
npm run dev
```

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
npm run build
npm run electron:start
```

Build a distributable Linux AppImage:

```bash
npm run electron:build:appimage
```

The artifact is written to `dist-electron/`.
Automated CI build is defined in `.github/workflows/appimage.yml`.

### Mobile bridge bootstrap (Capacitor)

The app now auto-installs a default Capacitor bridge at startup when running in a native Capacitor runtime. The default bridge currently provides:

- file open via native FilePicker when available (with input fallback)
- file open from known path via Filesystem plugin when available
- file save/save-as via Filesystem plugin when available (save-as can trigger native share)
- storage bridge based on localStorage-compatible behavior

This keeps the same Port contract active while native plugin wiring is added incrementally.

### Install as PWA

1. Deploy the production build to a host (for example Vercel, Netlify, Cloudflare Pages). **HTTPS is required** for PWA.
2. Open the app URL in the browser.
3. **iOS (Safari):** Share -> Add to Home Screen
4. **Android (Chrome):** Menu -> Install app
5. **Desktop (Chrome/Edge):** use the install icon in the address bar

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
| `npm run preview` | Preview production build locally |
| `npm run preview -- --host` | Expose preview server to local network |
| `npm test` | Run tests (watch mode) |
| `npm run test:run` | Run tests once |
| `npm run electron:start` | Start Electron shell against built app |
| `npm run electron:dev:renderer` | Start renderer dev server for Electron |
| `npm run electron:dev:desktop` | Start Electron shell against renderer dev server |
| `npm run electron:build:appimage` | Build Linux AppImage artifact into `dist-electron/` |

## Project Structure

```
src/
├── components/
│   ├── canvas/         # Canvas editor (react-konva)
│   ├── StartScreen.tsx  # Start screen with recent projects
│   ├── LayoutPicker.tsx # Layout selection dropdown
│   └── CropModal.tsx    # Free crop modal (4 sides + corners)
├── store/              # zustand state management
├── types/              # TypeScript interfaces
├── utils/
│   ├── fileIO.ts       # Save / Load .layox files
│   ├── layouts.ts      # 14 layout templates + computation
│   ├── exportProject.ts # PDF / PNG / JPEG export
│   └── handleStore.ts  # IndexedDB for file handles
├── App.tsx
└── main.tsx
```

## File Format

Projects are saved as `.layox` files — a ZIP container holding `project.json` and an `assets/` folder.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
