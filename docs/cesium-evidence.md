# Cesium Evidence Ledger

This file preserves the Cesium-specific conclusions that the current demo depends on, using
installed-package paths where possible and a frozen summary for upstream docs that are not
shipped through npm.

## Why This File Exists

This repo needs durable Cesium evidence without depending on workspace-local reference repos.
The rule is:

1. Prefer installed-package source paths under `node_modules/`.
2. Preserve repo-local summaries for upstream Cesium surfaces that are not distributed with the npm packages.
3. Keep ADRs and code comments pointing here or to installed-package paths, not to unrelated workspace locations.

## Installed-Package Checks

### Package Strategy

- `node_modules/cesium/package.json:2-55` pins the umbrella package at `1.140.0` and maps it to `@cesium/engine` and `@cesium/widgets`.

### Base URL And Runtime Assets

- `node_modules/@cesium/engine/Source/Core/buildModuleUrl.js:42-46` reads `CESIUM_BASE_URL` before falling back to `import.meta.url`.
- `node_modules/@cesium/engine/Source/Core/buildModuleUrl.js:64-67` throws when the base URL cannot be derived.
- `node_modules/@cesium/engine/Source/Core/buildModuleUrl.js:139-142` exposes the base-url override setter.
- `node_modules/@cesium/engine/Source/Core/TaskProcessor.js:91-125` derives worker module URLs from the shared Cesium base URL.
- `node_modules/@cesium/engine/Source/Core/TaskProcessor.js:237-243` sends the resolved Cesium base URL into worker messages.
- `node_modules/@cesium/widgets/Source/widgets.css:1-19` is the aggregate widget stylesheet entry point.

### Viewer Strategy

- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:1-39` shows `Viewer` composing engine primitives and widget modules into the higher-level shell.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:281-284` documents the constructor toggles for `baseLayerPicker` and `geocoder`.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:416-428` guards `baseLayerPicker`-specific options.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:564-588` shows conditional Geocoder construction.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:644-656` shows conditional BaseLayerPicker construction.

### Performance Budget Anchors

- `node_modules/@cesium/engine/Source/Scene/Scene.js:665-694` documents `requestRenderMode` and `maximumRenderTimeChange`.
- `node_modules/@cesium/engine/Source/Scene/Scene.js:698-705` shows rendering also being triggered by request and task completion events.

## Preserved Upstream Guidance

The npm packages do not ship Sandcastle, Specs, or Cesium's historical deployment guides. This repo preserves the stable conclusions it needs from those surfaces:

- Cesium-native `Viewer` defaults remain a valid repo baseline, including native controls and provider choices, unless an explicit product or deployment requirement says otherwise.
- Local or on-prem imagery, terrain, and tileset hosting remain supported through explicit provider configuration, but they are opt-in overrides rather than the only compliant default path.
- Static Cesium runtime assets should be served from an HTTP(S) path, not loaded from `file://`.
- When deeper Cesium behavior is unclear, the investigation order is Sandcastle, then Source, then Specs before any repo-local implementation is invented.

These conclusions were verified against the upstream Cesium reference material during repo bootstrap on `2026-04-15`. If the Cesium version pin changes or the bootstrap approach changes, re-verify and update this file in the same change set.

## Repo-Level Verification

`npm test` verifies the current build-verification assumptions by checking:

- built asset-copy output in `dist/`
- walker fixture integrity
- neutral delivery wording
- installed-package Cesium source surfaces referenced above

This file is the repo-local Cesium evidence anchor for the retained bootstrap baseline and the
current demo runtime.

## Globe-Baseline Evidence

### Atmosphere Baseline

- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/atmosphere/main.js:6-10` shows the atmosphere example pulling `scene.skyAtmosphere` and `scene.globe` from a standard `Viewer`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/atmosphere/main.js:60-97` shows the phase-relevant knobs: `showGroundAtmosphere`, `groundAtmosphere*`, and `skyAtmosphere*`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Globe.js:191-246` defines the ground-atmosphere properties used by the repo baseline.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/SkyAtmosphere.js:51-154` defines the sky-atmosphere switches and scattering controls, including `perFragmentAtmosphere`.

### Lighting Baseline

- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/lighting/main.js:1-11` shows the upstream lighting example enabling `scene.globe.enableLighting`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/lighting/main.js:126-139` shows the default lighting reset path using `dynamicAtmosphereLighting`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Globe.js:153-188` defines `enableLighting`, `dynamicAtmosphereLighting`, `dynamicAtmosphereLightingFromSun`, and `lambertDiffuseMultiplier`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/DynamicAtmosphereLightingTypeSpec.js:3-42` verifies that lighting stays off until `enableLighting` is true and that the sun-vs-scene-light switch is driven by `dynamicAtmosphereLightingFromSun`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/GlobeSpec.js:52-103` verifies the lighting and dynamic-atmosphere rendering path.

### Star Background

- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/mars/main.js:4-12` shows a `Viewer` wiring `skyBox: Cesium.SkyBox.createEarthSkyBox()` as the native star background path.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/google-streetview-panorama/main.js:264-268` shows the scene returning to the Earth sky box through `viewer.scene.skyBox = Cesium.SkyBox.createEarthSkyBox()`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/scene-rendering-performance/main.js:34-41` shows Cesium treating `scene.skyBox.show` as the upstream toggle instead of a custom background implementation.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/SkyBox.js:139-158` defines `SkyBox.createEarthSkyBox()` and the built-in Tycho star textures it resolves from Cesium assets.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Scene.js:284-334` defines `Scene#skyBox` and makes `backgroundColor` only the fallback when no sky box is present.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/SkyBoxSpec.js:33-47` verifies that a `SkyBox` assigned to `scene.skyBox` participates in rendering.

### Fog And Post-Process

- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/fog/main.js:20-64` shows the native fog tuning path through `viewer.scene.fog`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/mars/main.js:37-40` shows Cesium's built-in bloom stage being enabled without adding a custom fragment shader.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Fog.js:11-164` defines the fog controls used here, including `density`, `visualDensityScalar`, `heightScalar`, `heightFalloff`, `maxHeight`, and `minimumBrightness`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/FogSpec.js:18-58` verifies that fog disables above `maxHeight` and that the configured values pass through to frame state.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/PostProcessStageCollection.js:32-56` defines the built-in bloom stage and its default-disabled baseline.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/PostProcessStageCollectionSpec.js:13-31` verifies that the collection exposes `bloom` as a native post-process stage.

### Imagery Provider Defaults And Optional Overrides

- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:295-299` documents the default imagery selection rules used by `Viewer`, including the `selectedImageryProviderViewModel`, `imageryProviderViewModels`, and `baseLayer` paths.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:564-588` and `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:645-678` show that `Geocoder`, `BaseLayerPicker`, and explicit `baseLayer` replacement are all optional runtime choices rather than a mandatory offline shell pattern.
- `node_modules/@cesium/widgets/Source/BaseLayerPicker/createDefaultImageryProviderViewModels.js:16-118` shows Cesium's native imagery-provider catalog, including the default Cesium-ion-backed entries and other upstream-owned imagery choices.
- `node_modules/@cesium/engine/Source/Scene/TileMapServiceImageryProvider.js:18-27` and `node_modules/@cesium/engine/Source/Scene/TileMapServiceImageryProvider.js:108-149` define the explicit TMS override path used when a deployment chooses mirrored or local imagery instead of the native default provider set.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/offline/main.js:10-16` remains useful as an example of an explicit local-TMS configuration, but this repo no longer treats that example as the required default shell.

### Terrain Provider Defaults And Optional Overrides

- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:297-303` documents the native terrain entry points, including default ellipsoid terrain plus explicit `selectedTerrainProviderViewModel`, `terrainProviderViewModels`, `terrainProvider`, and `terrain`.
- `node_modules/@cesium/widgets/Source/Viewer/Viewer.js:681-699` shows that custom terrain injection is an explicit override path layered on top of the standard `Viewer` shell.
- `node_modules/@cesium/widgets/Source/BaseLayerPicker/createDefaultTerrainProviderViewModels.js:12-44` shows Cesium's native terrain choices, including `WGS84 Ellipsoid` and `Cesium World Terrain`.
- `node_modules/@cesium/engine/Source/Core/CesiumTerrainProvider.js:1191-1207` defines `CesiumTerrainProvider.fromUrl(...)` for explicit local, mirrored, or on-prem terrain datasets.
- `node_modules/@cesium/engine/Specs/Scene/TerrainSpec.js:15-58`, `node_modules/@cesium/engine/Specs/Core/EllipsoidTerrainProviderSpec.js:18-36`, and `node_modules/@cesium/widgets/Specs/Viewer/ViewerSpec.js:99-105` plus `node_modules/@cesium/widgets/Specs/Viewer/ViewerSpec.js:425-436` verify the native terrain baseline, the ellipsoid fallback path, and the explicit terrain-injection behavior.

### Home And Camera Language - FlyTo Tuning

- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/mars/main.js:180-184` shows scene-level camera transitions using Cesium's native `camera.flyTo(...)` path.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/scene-rendering-performance/main.js:28-36` shows `camera.flyHome(0.0)` being used as the upstream reset path for scene cleanup.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Camera.js:290-303` defines `Camera.DEFAULT_VIEW_RECTANGLE` and `Camera.DEFAULT_VIEW_FACTOR`, while `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Camera.js:1542-1573` shows `flyHome(duration)` consuming those defaults.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/Camera.js:3310-3367` documents the `flyTo` tuning inputs used here, including `orientation`, `duration`, `maximumHeight`, `pitchAdjustHeight`, and `easingFunction`.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/HomeButton/HomeButtonViewModel.js:13-24` shows the built-in home button dispatching `camera.flyHome(duration)`, and `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/Viewer/Viewer.js:598-611` shows `Viewer` wiring the home-button command into the delivery shell.
- `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CameraSpec.js:3621-3662` verifies `flyTo` option forwarding, `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CameraSpec.js:3771-3838` verifies `flyHome` behavior across scene modes, and `/home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Specs/Scene/CameraSpec.js:4318-4344` verifies `flyTo` with a rectangle destination plus orientation.
