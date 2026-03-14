# AGENT.md

This file is a compact technical orientation for developers and AI agents in this repository.

## Project Goal

Layox is a local-first photo album editor (no backend, no cloud), built with React + Konva.

## Key Architecture

- UI entry: `src/App.tsx`
- Start screen: `src/components/StartScreen.tsx`
- Editor canvas: `src/components/canvas/EditorCanvas.tsx`
- State management: `src/store/useProjectStore.ts` (Zustand)
- Layout logic: `src/utils/layouts.ts`
- File I/O (`.layox` ZIP): `src/utils/fileIO.ts`
- Export (PDF/PNG/JPEG): `src/utils/exportProject.ts`

## Canvas Baseline (Critical)

- The **internal working area** is defined centrally in:
  - `src/constants/canvas.ts`
- Current values:
  - `CANVAS_W = 1200`
  - `CANVAS_H = 900`
- These values control:
  - Layout calculation
  - Konva stage size
  - Export scaling
  - Placement of new elements

**Rule:** Do not introduce new hardcoded values like `800/600`. Always import the constants.

## UI/UX Guidelines

- Keep the start page style (the user likes this design).
- Editor view should stay clean, modern, and calm.
- Dropdowns must always render above the canvas (`z-index` / stacking context).
- With many pages, avoid showing all page chips at once; use compressed navigation.

## Text Editing

Inline-Editor in `EditorCanvas.tsx`:

- Multiline writing is allowed
- `Enter` = line break
- `Ctrl/Cmd + Enter` = Commit
- `Escape` = cancel
- Textarea auto-resize is enabled

## Persistence / Files

- Project format: `.layox` (ZIP with `project.json` + `assets/`)
- Recent projects:
  - List in `localStorage`
  - File Handles in IndexedDB (`src/utils/handleStore.ts`)
- Double-clicking a recent project attempts direct reopen using the stored handle

## PWA

- Configured via `vite-plugin-pwa` in `vite.config.ts`
- Manifest, service worker, and icons are generated during build
- Icons are in `public/icon-192.png` and `public/icon-512.png`
- Meta tags (`apple-touch-icon`, `theme-color`) are set in `index.html`
- Touch support uses pointer events instead of HTML5 drag & drop (PageOverviewModal) and mouse events (CropModal)

## Tests and Quality

- Unit/Integration: Vitest
- Important commands:
  - `npm test`
  - `npm run test:run`
  - `npx tsc -b`
  - `npm run build`
  - `npm run preview -- --host` (local PWA testing)

## Change Principles

- Do root-cause fixes instead of workarounds
- Do not expand existing UX unnecessarily
- Respect established patterns and naming
- Prefer small, focused changes
- Always run build and tests after UI/store changes

## Notes for AI Agents

1. Read relevant files fully before larger changes.
2. Treat canvas/layout/export adjustments as one coupled system.
3. Update README and, when needed, `FEATURES.md` for new features.
4. For potentially breaking UI changes, start with the least invasive option.
5. Avoid unnecessary new dependencies.
