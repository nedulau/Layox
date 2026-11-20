# Dependency security maintenance

## Application security hardening (2026-11-20)

In addition to runtime and dependency updates (tracked separately), the
2026-11-20 review hardened two local trust boundaries:

- **SEC-03 (`.layox` archive decompression limits):** `src/utils/projectArchive.ts`
  now streams `project.json` and every `assets/*` entry via JSZip
  `internalStream('uint8array')`, enforcing per-entry byte limits, cumulative
  uncompressed asset budgets (512 MiB), and compression-ratio limits (including
  on `project.json`) against actual decompressed bytes rather than trusting ZIP
  Central Directory headers alone. Asset paths in both schema validation and
  archive handling also reject backslashes, empty segments, and control
  characters.
- **SEC-04 (Electron IPC path boundaries & storage isolation):**
  `electron/main/index.mjs` and `electron/main/security.mjs` restrict
  `layox:open-project-from-path` and in-place `layox:save-project` overwrites to
  paths authorized by native dialogs in the current session or loaded from
  persisted `layox_recentProjects` at startup, reject unauthorized paths in
  renderer `layox_recentProjects` writes, reject symbolic links on read and
  overwrite (`lstat` + `O_NOFOLLOW`), enforce pure `.layox` basenames for save
  payloads, and isolate the settings cache via `Object.create(null)` while
  blocking prototype keys.

The project health review on **2026-11-02** identified the following dependency
issues. The remediation changes package versions and build tooling; project file
schema and archive validation (TD-03) are outside this change.

| Finding | Dependency path and remedy | Advisory examples |
| --- | --- | --- |
| SEC-01 | Development server: Vite 8.3.2 → 8.3.5, including its updated editor launcher. | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) |
| SEC-02 | Shipped desktop runtime: Electron 44.5.1 → 44.10.1, retaining the supported major line. | [GHSA-jr5w-w6x2-84p9](https://github.com/advisories/GHSA-jr5w-w6x2-84p9) |
| SEC-03 | jsPDF's optional runtime DOMPurify dependency: override 3.4.17. | [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) |
| SEC-04 | Test environment jsdom 30.1.3; version-scoped undici overrides retain each consumer's major (6.29.1 for node-gyp, 7.30.1 for Electron download tooling, 8.12.3 for jsdom); source-map-js 1.2.2 for Tailwind/PostCSS; Zod 4.6.7 for React Hooks linting. | [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx), [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| SEC-05 | Build/lint dependencies: fast-uri 3.1.9, glob 14.0.3, minimatch 11.0.3, serialize-javascript 7.1.4; upstream `deepmerge` 4.3.1 restored after `GHSA-gcqx-w48m-w2h4` withdrawal. | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), [GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v), [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |

The original npm audit reported 34 affected package entries, including parent
packages affected through their dependencies; these are not 34 independent
vulnerabilities. Overrides apply at installation time, without `--force`,
`--legacy-peer-deps` or advisory exclusions. Glob and minimatch cross major
versions because their fixes are unavailable on the old lines. Lint, coverage,
web/PWA builds, browser and Electron E2E, and a real Linux AppImage build and
startup check must pass when changing these overrides.

## Withdrawn deepmerge advisory (2026-11-16)

[GHSA-gcqx-w48m-w2h4 / CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
was officially withdrawn on **2026-11-16** (*"This advisory has been withdrawn
because it does not describe a security vulnerability"*). The temporary local
`vendor/deepmerge` package, its npm override, its ESLint exclusion, and its
dedicated patch regression test have therefore been removed, restoring the
upstream `deepmerge` 4.3.1 registry package under standard `npm audit` tracking.

## Scope and continuing checks

The Vite advisories concern development server exposure, including documented
`--host` use. DOMPurify's vulnerable HTML modes were not found in Layox's PDF
export, which uses `addImage`. No application TLS connection using Electron's
affected certificate trust was found. Updating these components removes the
affected versions without asserting that these paths were exploitable in Layox.
Toolchain findings affect development, installation, testing or packaging and
are not automatically application runtime vulnerabilities.

Use `npm ci`, `npm run check`, `npm run audit:ci`, and the documented E2E and
packaging commands for ongoing maintenance. Use `npm audit --audit-level=low`
when checking all reported severities. A clean scan is a point-in-time registry
result, not proof that the application has no security weaknesses. No active
scan of a deployed system is part of these checks.
