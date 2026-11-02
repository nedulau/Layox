# Local deepmerge security patch

This directory vendors the CommonJS bundle, TypeScript declarations and MIT
license from **deepmerge 4.3.1**, published at
<https://registry.npmjs.org/deepmerge/-/deepmerge-4.3.1.tgz>.
The archive was verified against its npm SHA-512 integrity:

```text
sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==
```

Upstream file SHA-256 checksums before modification:

| File | SHA-256 |
| --- | --- |
| `dist/cjs.js` | `2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d` |
| `index.d.ts` | `146ba4b99c5feb82663e17a671bf9f53bb39c704cd76345d6c5a801c26372f44` |
| `license.txt` | `6cfc4687cb2f2d86f4a77e6b526290d3878e5e512f3fec2f4cb36a9cb36f798b` |

## Reason and patch

[GHSA-gcqx-w48m-w2h4 / CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
affects prototype handling in deepmerge. As checked on 2026-11-02, npm's latest
release remains 4.3.1 and no patched upstream release is available.

The three assignments to `destination[key]` in the upstream `mergeObject`
function now use a small `defineDataProperty` helper. It calls
`Object.defineProperty` with an enumerable, writable, configurable own data
property. A copied `__proto__` key therefore cannot invoke the inherited setter
and replace the result's prototype. This covers target copying, null-prototype
sources and recursive merges without removing ordinary data keys. Other upstream
behavior and the declarations are unchanged. `dist/cjs.js` is renamed to
`index.cjs`; package metadata points to this self-contained bundle.

The root npm override installs this local package for Workbox's Rollup resolver.
It retains the upstream version number; it does not claim to be an upstream fix.
**npm audit does not match local file packages against registry advisories.**
Consequently a clean audit alone cannot verify this patch. Regression tests in
`src/security/__tests__/deepmerge.test.ts` import the installed package and check
the attack paths, property descriptors and normal merge APIs. Web/PWA and desktop
packaging checks exercise the consuming toolchain.

## Maintenance

When an upstream fix is published, inspect it against these regressions, replace
the local override with the fixed release, remove this directory, and rerun the
security tests, clean installation, audit, web/PWA build and desktop packaging.
Any future change to this local package must also update the lockfile entry.
