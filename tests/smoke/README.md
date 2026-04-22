# Smoke Tests

`npm test` is the top-level verification bundle. The script file still has the older
`verify-phase0` name for compatibility, but it should now be read as a generic verification
step rather than an active project phase.

The current check verifies:

- the build completes
- copied Cesium runtime assets exist in `dist/`
- the walker fixture remains intact
- delivery-facing files stay neutral
- installed-package Cesium evidence still matches the repo's recorded assumptions
- focused contract checks still pass

`npm run test:contract` runs the focused contract checks:

- 3D Tiles InfoBox sanitization
- stage-overlay selection passthrough

Runtime bootstrap and first-globe smoke are exposed through `node tests/smoke/bootstrap-loads-assets-and-workers.mjs`.

`npm run test:phase1` is the browser verification bundle for the built app. The command name is
retained for compatibility, but it now means:

- build the repo
- run the focused contract checks
- serve `dist/` locally
- open the built app in a headless browser
- confirm that the bootstrap state reaches `ready`
- click the `NTPU` preset and confirm local focus activates
- confirm `Home` clears local focus without resetting the user-selected sky mode
- confirm a center-screen double-click can re-enter local focus from the wide globe

`npm run test:local-focus` runs only the local-focus interaction regression on the built app.
