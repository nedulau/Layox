# AGENT.md

Diese Datei ist die kompakte technische Orientierung für Entwickler und KI-Agenten in diesem Repository.

## Projektziel

Layox ist ein lokal arbeitender Fotoalbum-Editor (kein Backend, keine Cloud), basierend auf React + Konva.

## Wichtige Architektur

- UI-Einstieg: `src/App.tsx`
- Startscreen: `src/components/StartScreen.tsx`
- Editor-Canvas: `src/components/canvas/EditorCanvas.tsx`
- State-Management: `src/store/useProjectStore.ts` (Zustand)
- Layout-Logik: `src/utils/layouts.ts`
- Datei-I/O (`.layox` ZIP): `src/utils/fileIO.ts`
- Export (PDF/PNG/JPEG): `src/utils/exportProject.ts`

## Canvas-Standard (kritisch)

- Die **interne Arbeitsfläche** ist zentral definiert in:
  - `src/constants/canvas.ts`
- Aktuell:
  - `CANVAS_W = 1200`
  - `CANVAS_H = 900`
- Diese Werte steuern:
  - Layout-Berechnung
  - Konva-Stage-Größe
  - Export-Skalierung
  - Positionierung neuer Elemente

**Regel:** Keine neuen Hardcodes wie `800/600` einführen. Immer die Konstanten importieren.

## UI-/UX-Richtlinien

- Startseite beibehalten (Nutzer mag das Design).
- Editor-Ansicht: clean, modern, ruhig.
- Dropdowns müssen immer über dem Canvas liegen (`z-index` / stacking context beachten).
- Bei vielen Seiten nicht alle Page-Chips gleichzeitig anzeigen; komprimierte Navigation verwenden.

## Textbearbeitung

Inline-Editor in `EditorCanvas.tsx`:

- Mehrzeiliges Schreiben erlaubt
- `Enter` = Zeilenumbruch
- `Ctrl/Cmd + Enter` = Commit
- `Escape` = Abbrechen
- Auto-Resize des Textareas aktiv

## Persistenz / Dateien

- Projektformat: `.layox` (ZIP mit `project.json` + `assets/`)
- Letzte Projekte:
  - Liste in `localStorage`
  - File Handles in IndexedDB (`src/utils/handleStore.ts`)
- Doppelklick auf zuletzt geöffnetes Projekt versucht direkten Reopen über gespeicherten Handle

## Tests & Qualität

- Unit/Integration: Vitest
- Wichtige Befehle:
  - `npm test`
  - `npm run test:run`
  - `npx tsc -b`
  - `npm run build`

## Änderungsprinzipien

- Root-Cause statt Workaround
- Bestehende UX nicht unnötig erweitern
- Bestehende Patterns/Benennungen respektieren
- Kleine, fokussierte Änderungen bevorzugen
- Nach UI-/Store-Änderungen immer Build + Tests laufen lassen

## Hinweise für KI-Agenten

1. Vor größeren Änderungen relevante Dateien vollständig lesen.
2. Canvas-/Layout-/Export-Anpassungen immer zusammen denken.
3. Bei neuen Features README + ggf. `FEATURES.md` aktualisieren.
4. Bei potenziell breaking UI-Änderungen zuerst minimal-invasive Variante wählen.
5. Keine unnötigen neuen Abhängigkeiten hinzufügen.
