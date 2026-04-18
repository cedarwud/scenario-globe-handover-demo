# ADR 0005: Performance Budget

## Status

Proposed

## Context

Phase 0 has not executed any browser or hardware measurements yet, but the repo still needs candidate performance tiers and a measurement shape before visual work begins. The first real measurements happen after the globe foundation exists.

Evidence:

- `node_modules/@cesium/engine/Source/Scene/Scene.js:665-694` documents `requestRenderMode` and `maximumRenderTimeChange` as built-in rendering budget controls.
- `node_modules/@cesium/engine/Source/Scene/Scene.js:698-705` shows render requests also being driven by request and task completion events.

## Decision

Keep this ADR in `Proposed` state for Phase 0 and carry the following candidate tiers into Phase 2 validation:

- Tier 1: Apple Silicon M1 or M2 class machine, Chromium 120+ at 1080p full window, target 60 FPS during globe-only preset switching.
- Tier 2: Intel UHD 620 or 630 class integrated graphics, Chromium 120+ at 1080p full window, target at least 30 FPS and no collapse below 20 FPS during preset switching.
- Tier 3: software raster or comparable lower-bound environment, used only to confirm the app still runs and not as a quality gate.

Measurements will use the globe-only baseline under the Cesium-native default profile, with no satellite overlays and no replay stack enabled. If an explicit local/on-prem provider override is measured, record it as a separate deployment-profile variant rather than the default baseline.

## Consequences

- No Phase 0 file may claim that the performance budget has already been validated.
- Phase 2 must revise this ADR with exact hardware, browser, driver, and captured measurements before the status can change to `Accepted`.
- The future performance layer should prefer Cesium's explicit-render controls before introducing custom throttling behavior.
- Phase 1 bundle size and build warnings should be recorded as baseline evidence, but performance acceptance decisions should wait until Phase 2 exposes the real globe-quality cost.
