# Layox

A local-first, privacy-focused photo album creator. No cloud, no server — everything stays on your device.

> **Vollständige Feature-Übersicht → [FEATURES.md](FEATURES.md)**

## Highlights

- **Drag & Drop** Bilder auf den Canvas ziehen
- **14 Layout-Vorlagen** — von Einzelbild bis Mosaik, plus freie Anordnung
- **Mehrseitige Projekte** mit Deckblatt, Seitennavigation und Inline-Textbearbeitung
- **Crop & Zoom** — Bilder frei beschneiden von allen Seiten, Scroll-Zoom in Slots
- **Pixelwarnung** — Hinweis wenn ein Bild eine zu niedrige Auflösung hat
- **PDF-Export** mit wählbarer Kompression (keine / gering / mittel / stark)
- **PNG- & JPEG-Export** der aktuellen Seite
- **Rückgängig / Wiederherstellen** — bis zu 50 Schritte
- **Auto-Save** — konfigurierbar im Datei-Menü
- **Offline-first** — `.layox`-Dateien (ZIP) lokal speichern und laden

## Tech Stack

- **Vite** + **React** + **TypeScript**
- **react-konva** – Canvas rendering
- **zustand** – State management
- **Tailwind CSS** – UI styling
- **jszip** / **file-saver** / **jspdf** – File handling & export
- **vitest** + **@testing-library/react** – Tests

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check & build for production |
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
