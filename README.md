# Layox

A local-first, privacy-focused photo album creator. No cloud, no server — everything stays on your device.

> **Vollständige Feature-Übersicht → [FEATURES.md](FEATURES.md)**

## Highlights

- **Drag & Drop** Bilder auf den Canvas ziehen
- **14 Layout-Vorlagen** — von Einzelbild bis Mosaik, plus freie Anordnung
- **Mehrseitige Projekte** mit Deckblatt, Seitennavigation und Inline-Textbearbeitung
- **Seitenübersicht mit Vorschaubildern** (klickbar, feste Thumbnail-Größe, dynamisches Grid)
- **Crop & Zoom** — Bilder frei beschneiden von allen Seiten, Scroll-Zoom in Slots
- **Canvas-Zoomsteuerung** mit `100%`, `Anpassen`, `+`, `−`
- **Pixelwarnung** — Hinweis wenn ein Bild eine zu niedrige Auflösung hat
- **PDF-Export** mit wählbarer Kompression (keine / gering / mittel / stark)
- **PNG- & JPEG-Export** der aktuellen Seite
- **Rückgängig / Wiederherstellen** — bis zu 50 Schritte
- **Auto-Save** — konfigurierbar in den Einstellungen
- **UI Dark/Light Mode** — umschaltbar im Startscreen und im Editor
- **Deutsch / Englisch** — umschaltbar im Startscreen und in den Einstellungen
- **Offline-first** — `.layox`-Dateien (ZIP) lokal speichern und laden
- **PWA** — als App auf dem Home-Bildschirm installierbar (iOS, Android, Desktop)
- **Touch-optimiert** — Seitenübersicht und Crop-Modal funktionieren per Touch auf Tablets

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

## Ausführungsmodi

### Entwicklung

```bash
npm run dev
```

Startet den Vite Dev-Server mit Hot Module Replacement unter `http://localhost:5173`. Kein Service Worker, keine PWA-Features — ideal zum Entwickeln.

### Production Build + lokales Testen

```bash
npm run build
npm run preview -- --host
```

Erstellt den optimierten Build in `dist/` (inkl. Service Worker & Web App Manifest) und startet einen lokalen Preview-Server. Mit `--host` ist er im WLAN erreichbar — auch vom Handy/Tablet.

### PWA auf Geräten installieren

1. Den Production Build auf einen Hosting-Dienst deployen (z.B. Vercel, Netlify, Cloudflare Pages) — **HTTPS ist Pflicht** für PWA.
2. URL im Browser öffnen.
3. **iOS (Safari):** Teilen → „Zum Home-Bildschirm"
4. **Android (Chrome):** Menü → „App installieren"
5. **Desktop (Chrome/Edge):** Install-Icon in der Adressleiste

Die App läuft dann im Fullscreen-Modus mit eigenem Icon und Offline-Support.

### Im lokalen Netzwerk teilen (ohne Hosting)

```bash
npm run dev -- --host
```

Zeigt eine Network-URL an (z.B. `http://192.168.1.X:5173`). Alle Geräte im selben WLAN können darauf zugreifen.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run dev -- --host` | Dev server im Netzwerk freigeben |
| `npm run build` | Type-check & build for production (inkl. PWA) |
| `npm run preview` | Production Build lokal testen |
| `npm run preview -- --host` | Production Build im Netzwerk freigeben |
| `npm test` | Run tests (watch mode) |
| `npm run test:run` | Run tests once |

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
