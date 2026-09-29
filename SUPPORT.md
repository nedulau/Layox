# Layox support matrix

| Platform | Status | Editing | Open/save/recovery | Release gate |
|---|---|---:|---:|---:|
| Web/PWA desktop, current Chromium-family browser | Supported | Yes | Yes | Yes |
| Web/PWA tablet, 768-1023 px | Supported | Yes | Yes | Yes, Chromium at 768 px |
| Linux x64 AppImage | Supported | Yes | Native open/save and recovery | Yes, Electron E2E and Xvfb smoke test |
| Smartphone browser/PWA, below 768 px | Limited | No | Start screen, open, and recovery | Limited-view E2E |
| Capacitor native wrapper | Experimental | Not guaranteed | Adapter contract tests only | No |
| Windows/macOS desktop packages | Not currently shipped | Not guaranteed | Not guaranteed | No |

## Browser notes

- The File System Access API is used where available. Other browsers receive `.layox` downloads and use a file input for opening.
- Cancelling a native browser file dialog does not trigger a fallback download.
- PWA offline use is verified after the first successful production load.
- Applying an available PWA update is always explicit and is disabled while content is unsaved.

## Privacy

Layox has no backend requirement, analytics SDK, telemetry, or production tracking request. Project archives, recent-project metadata, preferences, and recovery snapshots are stored locally on the device. Hosting the static PWA does not receive project content from the application.

## Stable scope

The supported beta supports classic 1200 × 900 projects plus A4 landscape/portrait and square page formats, selectable export DPI, existing layout templates, and compression presets. Capacitor remains experimental; Web/PWA and Linux AppImage are the release-supported targets.
