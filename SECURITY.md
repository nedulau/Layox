# Dependency security maintenance

The project health review on **2026-11-02** identified the following dependency
issues. The remediation changes package versions and build tooling; project file
schema and archive validation (TD-03) are outside this change.

| Finding | Dependency path and remedy | Advisory examples |
| --- | --- | --- |
| SEC-01 | Development server: Vite 8.3.2 → 8.3.5, including its updated editor launcher. | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) |
| SEC-02 | Shipped desktop runtime: Electron 44.5.1 → 44.10.1, retaining the supported major line. | [GHSA-jr5w-w6x2-84p9](https://github.com/advisories/GHSA-jr5w-w6x2-84p9) |
| SEC-03 | jsPDF's optional runtime DOMPurify dependency: override 3.4.17. | [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) |
| SEC-04 | Test environment jsdom 30.1.3; version-scoped undici overrides retain each consumer's major (6.29.1 for node-gyp, 7.30.1 for Electron download tooling, 8.12.3 for jsdom); source-map-js 1.2.2 for Tailwind/PostCSS; Zod 4.6.7 for React Hooks linting. | [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx), [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| SEC-05 | Build/lint dependencies: fast-uri 3.1.9, glob 14.0.3, minimatch 11.0.3, serialize-javascript 7.1.4; local deepmerge patch for Workbox's Rollup resolver. | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), [GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v), [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) |

The original npm audit reported 34 affected package entries, including parent
packages affected through their dependencies; these are not 34 independent
vulnerabilities. Overrides apply at installation time, without `--force`,
`--legacy-peer-deps` or advisory exclusions. Glob and minimatch cross major
versions because their fixes are unavailable on the old lines. Lint, coverage,
web/PWA builds, browser and Electron E2E, and a real Linux AppImage build and
startup check must pass when changing these overrides.

## Local deepmerge patch

There is no patched upstream deepmerge release as of the review date. The
repository contains its MIT-licensed 4.3.1 CommonJS bundle with a focused fix:
merges define own data properties instead of invoking inherited setters. The
root development dependency anchors the local package, and the `$deepmerge`
override routes transitive consumers to that same implementation.

See [vendor/deepmerge/README.md](vendor/deepmerge/README.md) for provenance,
upstream hashes, the precise patch and removal instructions. The installed
package is covered by `src/security/__tests__/deepmerge.test.ts`, including
prototype attacks through both inputs and recursive merges, plus normal merge
behavior. Vendored upstream files are excluded from project linting.

**npm audit does not assess local file packages against registry advisories.**
The local remediation is therefore supported by source review and regression
tests, not a claim that npm has certified it. Keep this exception visible until
the local package can be replaced with a verified upstream fix.

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
