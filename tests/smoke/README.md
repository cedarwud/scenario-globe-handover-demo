# Smoke Tests

`npm test` is the build-verification bundle. The script file still has the older
`verify-phase0` name for compatibility, but it should now be read as a generic verification
step rather than an active project phase.

The current check verifies:

- the build completes
- copied Cesium runtime assets exist in `dist/`
- the walker fixture remains intact
- delivery-facing files stay neutral
- installed-package Cesium evidence still matches the repo's recorded assumptions

Runtime bootstrap and first-globe smoke are exposed through `node tests/smoke/bootstrap-loads-assets-and-workers.mjs`.

`npm run test:phase1` is the browser bootstrap smoke. The command name is retained for
compatibility, but it now means:

- build the repo
- serve `dist/` locally
- open the built app in a headless browser
- confirm that the bootstrap state reaches `ready`
