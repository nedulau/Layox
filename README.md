# Layox

A local-first, privacy-focused photo album creator.

## Features

### Projekt-Verwaltung
- **Startbildschirm** mit zuletzt geöffneten Projekten
- **Neues Projekt erstellen** — Deckblatt wird automatisch als erste Seite angelegt
- **Speichern / Speichern unter** — nativer File System Access API oder Fallback-Download
- **Projekt öffnen** — `.layox`-Dateien (ZIP-Format) laden
- **Automatisches Speichern** — aktivierbar mit wählbarem Intervall (10 s – 5 min)
- **Zuletzt geöffnete Projekte** — werden im Startbildschirm angezeigt (localStorage)

### Seiten & Navigation
- **Mehrseitige Projekte** — Seiten hinzufügen, entfernen, frei navigieren
- **Seitennavigation** mit nummerierten Buttons, Pfeiltasten (← →) und ◀/▶-Buttons neben dem Canvas
- **Deckblatt-System** — spezielle Deckblatt-Seiten mit Titel & Untertitel-Overlay
- **Doppelklick auf Deckblatt-Titel / -Untertitel** zum direkten Bearbeiten auf dem Canvas

### Layouts
- **8 Layout-Vorlagen**: Deckblatt (Vollbild), Deckblatt (Mitte), Einzelbild, Zwei nebeneinander, Zwei übereinander, Drei Spalten, Vierer-Raster, 1 groß + 2 klein
- **Slot-basiertes System** — Bilder werden in feste Positionen eingefügt
- **Layout-Picker** mit SVG-Vorschau-Thumbnails
- **Konfigurierbarer Rand & Abstand** für jedes Layout
- **Freie Anordnung** als Alternative — Elemente frei positionieren

### Bilder
- **Bilder einfügen** per Button oder Drag & Drop auf den Canvas
- **Bild-Panning** in Layout-Slots — Bild innerhalb des Slots verschieben
- **Zoom in Slots** per Scroll-Rad (1×–5×)
- **Echter Beschnitt (Crop)** — Doppelklick auf ein Slot-Bild schneidet den sichtbaren Bereich zu; Scroll passt den Crop-Bereich an
- **Crop zurücksetzen** per Toolbar-Button
- **Freie Bild-Elemente** — frei positionierbar, skalierbar, drehbar (außerhalb von Layouts)

### Text
- **Text-Elemente hinzufügen** — frei positionierbar, drehbar
- **Doppelklick zum Bearbeiten** von Text-Inhalten
- **Schriftgröße & Farbe** in der Toolbar einstellbar

### Canvas
- **Responsives Skalieren** — Canvas passt sich automatisch an die Fenstergröße an (kein Limit)
- **800 × 600 internes Koordinatensystem** mit CSS-Transform-Skalierung

### Tastenkürzel
- **Ctrl+S** — Speichern
- **Ctrl+Shift+S** — Speichern unter
- **Entf / Backspace** — Element oder Slot-Bild löschen
- **← / →** — Seite wechseln

### Dateiformat
- **`.layox`-Dateien** — ZIP-Container mit `project.json` und `assets/`-Ordner
- **Offline-first** — kein Server, keine Cloud, alles lokal

## Tech Stack

- **Vite** + **React** + **TypeScript**
- **react-konva** – Canvas rendering
- **zustand** – State management
- **Tailwind CSS** – UI styling
- **jszip** / **file-saver** / **jspdf** – File handling & export

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/
├── components/
│   ├── canvas/       # Canvas editor components (react-konva)
│   ├── StartScreen.tsx
│   └── LayoutPicker.tsx
├── store/            # zustand state management
├── types/            # TypeScript interfaces (Page, ImageElement, TextElement…)
├── utils/            # File I/O, layout computation
├── App.tsx
└── main.tsx
```

## File Format

Projects are saved as `.layox` files — a ZIP container holding `project.json` and an `assets/` folder.
