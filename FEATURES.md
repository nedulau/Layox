# Layox - Feature Overview

Detailed feature set of the local photo album editor.

## Project Management

- Start screen with recently opened projects
- Switchable language (German / English) on the start screen and in settings
- Switchable UI theme (Dark / Light) on the start screen and in settings
- Double-click on a recent project to reopen it directly (path is persisted)
- Create new projects with an automatic cover page
- Save / Save As via native File System Access API or fallback download
- Open existing `.layox` files (ZIP-based format)
- Optional auto-save with configurable interval (10 s - 5 min)
- Recent projects persisted via localStorage + IndexedDB handles

## Pages and Navigation

- Multi-page project support (add, remove, navigate)
- Numbered page controls with left/right arrows next to the canvas
- Page overview modal with thumbnails and responsive grid
- Chapter/subchapter metadata visible in page overview
- Close page overview via Escape, outside click, or close button
- Right arrow turns into `+` on the last page to append a new page
- Keyboard page navigation with left/right arrow keys
- Dedicated cover page type with title/subtitle overlay
- Double-click cover title/subtitle to edit directly on canvas

## Layouts

- 14 built-in layout templates (cover, single image, grids, mixed mosaics)
- Slot-based placement for fixed layout positions
- Layout picker with SVG preview thumbnails
- Configurable layout margin and spacing
- Free arrangement mode for manual positioning

## Images

- Insert images via button or drag and drop
- Pan images inside layout slots
- Wheel zoom in slots (1x-5x)
- True crop editing from edges/corners with scroll-assisted crop scaling
- Reset crop via toolbar action
- Free image elements: move, scale, rotate (outside slot layouts)
- Resolution warning icon for low-quality slot images

## Text

- Add free text elements with move/rotate controls
- Double-click for inline text editing on canvas
- Default placeholder `Edit text` is removed automatically when editing starts
- Font family, size, and color controls in contextual toolbar

## Export

- PDF export with compression presets:
  - No compression (max quality, PNG)
  - Low (JPEG 95%)
  - Medium (JPEG 80%)
  - High (JPEG 55%, smaller file)
- PNG export of current page (2x retina resolution)
- JPEG export of current page

## Canvas

- Responsive scaling to available horizontal space
- Explicit zoom controls (`100%`, `Fit`, `+`, `-`)
- Internal 1200 x 900 coordinate system with CSS transform scaling

## Editing

- Undo / redo history up to 50 steps (Ctrl+Z / Ctrl+Y)
- Quick insert buttons in toolbar (+ image, + text, + cover)
- Delete selected elements via Delete / Backspace

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+O | Open |
| Ctrl+N | New project |
| Ctrl+T | Add text |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Delete / Backspace | Delete selected element/image |
| Left / Right | Switch page |
| Escape | Clear selection |

## Touch Support

- Page overview supports touch-based reorder (pointer events)
- Crop modal supports touch interaction for crop box and handles
- Canvas elements support touch move/scale/rotate (via Konva)
- Optimized for iPad/tablet usage in PWA mode

## PWA (Progressive Web App)

- Installable on iOS, Android, and desktop
- Standalone fullscreen app mode
- Service worker for offline caching
- Web app manifest with app name, icons, and theme color
- Automatic activation of new app versions

## File Format

- `.layox` files are ZIP containers with `project.json` and `assets/`
- Offline-first architecture: no backend, no cloud, all local
