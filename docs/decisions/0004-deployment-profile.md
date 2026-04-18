# ADR 0004: Deployment Profile

## Status

Accepted

## Context

The repo needs one deployment baseline that preserves Cesium-native quality and shell behavior. Earlier wording over-interpreted `offline-first` and encouraged turning off or replacing native `Viewer` controls and provider paths simply because they were backed by Cesium services. The repo still needs an explicit path for local or on-prem imagery, terrain, and tilesets when a deployment asks for it, but that path must stay opt-in.

Evidence:

- [../deployment-profiles.md](../deployment-profiles.md) defines the current repo-level interpretation of deployment profiles.
- [../cesium-evidence.md](../cesium-evidence.md) preserves the current provider and `Viewer` evidence used by this repo.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:281-284` documents the constructor toggles for `baseLayerPicker` and `geocoder`.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:295-303` documents the default imagery and terrain entry points.
- `node_modules/@cesium/widgets/Source/BaseLayerPicker/createDefaultImageryProviderViewModels.js:16-118` and `node_modules/@cesium/widgets/Source/BaseLayerPicker/createDefaultTerrainProviderViewModels.js:12-44` show Cesium's native provider catalogs.

## Decision

Adopt Profile A, Cesium-native default, as both the delivery default and the development default. In this repo, `offline-first` means "stay on Cesium's upstream runtime path and avoid repo-local forks or fake substitute stacks," not "forbid Cesium-native services or controls."

Profile B remains the explicit local or on-prem override path for deployments that need mirrored imagery, terrain, or tilesets. Profile C remains an optional mixed or showcase profile for later stages.

Profile switching will be handled through provider-factory configuration rather than a separate Cesium fork or a separate bootstrap stack.

## Consequences

- Phase 2 quality gates must first be met on the Cesium-native baseline rather than by pre-emptively degrading the runtime shell.
- `BaseLayerPicker`, `Geocoder`, native imagery, native terrain, and other upstream-owned Cesium capabilities are not to be disabled or replaced solely to satisfy deployment wording.
- Credits remain required even when the data source is local or on-prem.
- Local imagery, terrain, and optional tileset hosting remain explicit project responsibilities when a delivery actually chooses Profile B, but they are not the only compliant default path.
