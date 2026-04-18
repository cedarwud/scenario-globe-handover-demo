# Deployment Profiles

This file records the repo's current deployment-profile interpretation for the demo-first runtime.
Keep it synchronized with ADR 0004, `architecture.md`, and `cesium-evidence.md`.

## Current Rule

For this repo, `offline-first` no longer means "disable or replace Cesium-native functionality until the app looks self-hosted."

It means:

- stay on Cesium's upstream runtime path
- avoid Cesium forks or parallel bootstrap stacks
- preserve native `Viewer` controls and provider behavior unless there is an explicit product requirement to change them
- treat local or on-prem imagery, terrain, and tilesets as opt-in deployment configuration, not as the only compliant default

In practical terms, Cesium-native features count as acceptable baseline behavior for this repo, even when those defaults are backed by Cesium services.

## Profile A: Cesium-Native Default

Use this as the demo default, development default, and verification baseline.

Expected characteristics:

- native `Viewer` shell stays intact
- native `BaseLayerPicker`, `Geocoder`, `HomeButton`, timeline, and credits remain available unless a separate product decision says otherwise
- native imagery and terrain choices remain valid baseline behavior
- an explicit ion token may be supplied to remove warning noise while staying on the same native path

This profile exists to protect visual quality and to prevent repo-local code from degrading the shell just to satisfy a planning term.

## Profile B: Explicit Local Or On-Prem Override

Use this only when a deployment explicitly requires mirrored or self-hosted providers.

Expected characteristics:

- the repo stays on the same `Viewer` shell
- imagery and terrain are swapped through explicit provider configuration
- local or mirrored assets are added as opt-in overrides rather than by replacing the default profile definition

Examples include:

- `VITE_CESIUM_IMAGERY_URL`
- `VITE_CESIUM_TERRAIN_URL`
- future explicit tileset URLs or mirrored provider endpoints

Profile B is supported, but it is not the baseline that the current demo should optimize against by default.

## Profile C: Mixed Or Showcase Variant

This remains an optional later-stage profile for demos or mixed asset strategies.

It must not silently replace Profile A as the normal development or validation path.

## Demo Interpretation

The current demo should improve globe readability on top of Cesium-native behavior. It should not:

- disable `Geocoder` or `BaseLayerPicker` just because a historical offline guide showed that pattern
- force low-fidelity local imagery as the default visual baseline
- force ellipsoid fallback terrain as the default visual baseline
- treat Cesium-native services as disallowed by definition

If a deployment truly needs local or on-prem providers, add them as explicit Profile B configuration and validate them separately.
