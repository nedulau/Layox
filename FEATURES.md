# Layox — Feature-Übersicht

Alle Funktionen des lokalen Fotoalbum-Editors im Detail.

---

## Projekt-Verwaltung

- **Startbildschirm** mit zuletzt geöffneten Projekten
- **Doppelklick** auf ein kürzlich geöffnetes Projekt öffnet es direkt (Pfad wird gespeichert)
- **Neues Projekt erstellen** — Deckblatt wird automatisch als erste Seite angelegt
- **Speichern / Speichern unter** — nativer File System Access API oder Fallback-Download
- **Projekt öffnen** — `.layox`-Dateien (ZIP-Format) laden
- **Automatisches Speichern** — aktivierbar mit wählbarem Intervall (10 s – 5 min), im Datei-Menü konfigurierbar
- **Zuletzt geöffnete Projekte** — werden im Startbildschirm angezeigt (localStorage + IndexedDB für Dateipfade)

## Seiten & Navigation

- **Mehrseitige Projekte** — Seiten hinzufügen, entfernen, frei navigieren
- **Seitennavigation** mit nummerierten Buttons und ◀/▶ neben dem Canvas
- **Rechter Pfeil wird zu +** wenn man auf der letzten Seite ist → fügt direkt eine neue Seite hinzu
- **Pfeiltasten (← →)** zum Seitenwechsel
- **Deckblatt-System** — spezielle Deckblatt-Seiten mit Titel & Untertitel-Overlay
- **Doppelklick auf Deckblatt-Titel / -Untertitel** zum direkten Bearbeiten auf dem Canvas

## Layouts

- **14 Layout-Vorlagen**:
  - Deckblatt (Vollbild)
  - Deckblatt (Mitte)
  - Einzelbild
  - Zwei nebeneinander
  - Zwei übereinander
  - Drei Spalten
  - Drei Zeilen
  - Vierer-Raster
  - Sechser-Raster
  - 1 groß + 2 klein
  - 1 oben + 2 unten
  - 2 oben + 1 unten
  - Seitenleiste links
  - Mosaik (5)
- **Slot-basiertes System** — Bilder werden in feste Positionen eingefügt
- **Layout-Picker** mit SVG-Vorschau-Thumbnails
- **Konfigurierbarer Rand & Abstand** für jedes Layout
- **Freie Anordnung** als Alternative — Elemente frei positionieren

## Bilder

- **Bilder einfügen** per Button oder Drag & Drop auf den Canvas
- **Bild-Panning** in Layout-Slots — Bild innerhalb des Slots verschieben
- **Zoom in Slots** per Scroll-Rad (1×–5×)
- **Echter Beschnitt (Crop)** — Freihand-Crop von allen 4 Seiten und Ecken; Scroll passt den Crop-Bereich an
- **Crop zurücksetzen** per Toolbar-Button
- **Freie Bild-Elemente** — frei positionierbar, skalierbar, drehbar (außerhalb von Layouts)
- **Pixelwarnung** — ⚠-Icon wenn ein Bild eine zu geringe Auflösung für den Slot hat

## Text

- **Text-Elemente hinzufügen** — frei positionierbar, drehbar
- **Doppelklick zum Bearbeiten** — Inline-Editing direkt auf dem Canvas
- **Platzhaltertext** „Text bearbeiten" wird beim Bearbeiten automatisch entfernt
- **Schriftart, Schriftgröße & Farbe** in der Kontext-Toolbar einstellbar

## Export

- **PDF-Export** mit wählbarer Kompression:
  - Keine Kompression (maximale Qualität, PNG)
  - Gering (JPEG 95 %)
  - Mittel (JPEG 80 %)
  - Stark (JPEG 55 %, kleine Datei)
- **PNG-Export** der aktuellen Seite (2× Retina-Auflösung)
- **JPEG-Export** der aktuellen Seite

## Canvas

- **Responsives Skalieren** — Canvas passt sich automatisch an die Fenstergröße an
- **800 × 600 internes Koordinatensystem** mit CSS-Transform-Skalierung

## Bearbeitung

- **Rückgängig / Wiederherstellen** — bis zu 50 Schritte (Ctrl+Z / Ctrl+Y)
- **Schnelleinfüge-Buttons** — + Bild, + Text, + Deckblatt direkt in der Toolbar
- **Elemente löschen** per Entf / Backspace

## Tastenkürzel

| Kürzel | Aktion |
|---|---|
| Ctrl+S | Speichern |
| Ctrl+Shift+S | Speichern unter |
| Ctrl+O | Öffnen |
| Ctrl+N | Neues Projekt |
| Ctrl+T | Text hinzufügen |
| Ctrl+Z | Rückgängig |
| Ctrl+Y | Wiederherstellen |
| Entf / Backspace | Element/Bild löschen |
| ← / → | Seite wechseln |
| Escape | Auswahl aufheben |

## Dateiformat

- **`.layox`-Dateien** — ZIP-Container mit `project.json` und `assets/`-Ordner
- **Offline-first** — kein Server, keine Cloud, alles lokal
