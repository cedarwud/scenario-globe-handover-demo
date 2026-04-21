# Architecture

This file describes the **current demo-first architecture** of `scenario-globe-handover-demo`.

It replaces the old reading of this repo as an active multi-phase Cesium delivery plan.
The older Cesium phase material is still retained for provenance, but the active repo shape is
now a same-page handover demo.

## 1. Repo Role

`scenario-globe-handover-demo` exists to prove one interaction:

**global orbit context + local handover focus can coexist inside one Cesium page**

This repo is therefore:

- not a generic Cesium foundation repo
- not a delivery-neutral globe baseline repo
- not a realism-first satellite simulator

It is a **visual-product demo repo** built on top of a native Cesium runtime.

## 2. Current Runtime Layers

The repo is organized into six active layers.

### 2.1 Cesium Bootstrap And Native Viewer Shell

Purpose:

- reserve `CESIUM_BASE_URL`
- initialize Cesium's upstream runtime
- create the native `Viewer`
- preserve native credits, toolbar, timeline, and home button behavior unless the demo needs an explicit override

Primary files:

- `index.html`
- `src/core/cesium/bootstrap.ts`
- `src/core/cesium/viewer-factory.ts`
- `src/main.ts`

### 2.2 Globe Baseline

Purpose:

- define the shared wide-view camera language
- apply atmosphere, star background, lighting, imagery, and terrain defaults
- keep the wide globe view visually usable for the demo

Primary files:

- `src/features/globe/camera-language.ts`
- `src/features/globe/atmosphere.ts`
- `src/features/globe/star-background.ts`
- `src/features/globe/lighting.ts`
- `src/features/globe/offline-imagery.ts`
- `src/features/globe/offline-terrain.ts`
- `src/features/globe/osm-buildings-showcase.ts`

### 2.3 Synthetic Global Constellation

Purpose:

- keep satellites moving in the Earth-scale scene
- preserve global context while the local focus is active
- give the local stage something to sample and rank against

Primary file:

- `src/features/demo/synthetic-constellation.ts`

Notes:

- orbit motion is synthetic
- shell definitions are synthetic
- orbit guide dots are narrative aids, not science output

### 2.4 Local Handover Focus

Purpose:

- turn a picked site into a same-page local scene
- compress candidate geometry into a readable elevated local sky corridor above the site
- drive three proxy satellites with a resident serving beam and a phase-gated pending preview cue

Primary file:

- `src/features/demo/handover-focus-demo.ts`

Key rule:

The local focus is **not** a literal physically correct zoom of the global scene.
It is a compressed presentation layer derived from the current synthetic candidates, and it should read as a globe-local sky window rather than a separate observer-sky simulator.

Current implementation note:

- `src/features/demo/handover-focus-demo.ts` still owns the local-focus controller as one file, but the internal runtime seam is now explicit:
  - local handover truth-frame building
  - local handover presentation-frame derivation
  - local handover shell-frame derivation
  - Cesium render application
  - shell / text synchronization
- a second Viewer instance or separate local-view runtime is not part of the current architecture direction

### 2.5 Toolbar-Level Demo Controls

Purpose:

- expose the demo-specific entry points without replacing the native Cesium shell

Primary files:

- `src/features/globe/sky-mode.ts`
- `src/features/globe/lighting-toggle.ts`
- `src/features/globe/ntpu-shortcut.ts`

Current controls:

- sky toggle
- lighting toggle
- NTPU preset shortcut
- native Home button

### 2.6 Optional Demo HUD Surface

Purpose:

- keep future explanatory UI surfaces available without making them the primary interaction

Primary file:

- `src/features/app/app-shell.ts`

Current status:

- left and right demo panels still exist
- both are hidden by default in the current demo state

## 3. Current Interaction Contract

The active interaction contract is:

1. app boots into a wide globe view
2. global synthetic satellites orbit continuously
3. user enters local focus by either:
   - double-clicking any site on Earth
   - clicking the NTPU preset shortcut
4. local focus shows:
   - closer camera composition
   - local proxy satellites
   - a resident serving beam / cone
   - a pending preview cue during `prepared` / `switching`
   - an unlinked context proxy that still participates in the corridor narrative
5. `Home` exits local focus and returns to the wide globe view

Sky behavior:

- local focus preserves the current sky mode instead of auto-switching it
- the default scene baseline uses `blue` sky mode
- the toolbar sky button can still override manually

## 4. Data And Control Flow

The runtime flow is now:

1. `index.html` reserves `window.CESIUM_BASE_URL`
2. `src/main.ts` initializes Cesium bootstrap and creates the `Viewer`
3. globe baseline modules attach scene defaults and toolbar controls
4. the synthetic constellation creates global entity-backed satellites
5. OSM Buildings may attach asynchronously as a best-effort context layer
6. local focus controller listens for globe double-click
7. site selection is converted into a local focus anchor
8. the local focus controller:
   - samples the current constellation
   - ranks candidates around the site
   - compresses them into elevated local sky-corridor proxy positions
   - updates site marker, proxy satellites, serving beam, pending preview cue, and optional HUD state

Current seam inside the same runtime:

1. build local handover truth
2. derive local presentation state from that truth
3. derive shell / explainer state from that truth
4. render the resulting presentation state into Cesium entities
5. sync shell / text state separately from Cesium mutation

## 5. Deliberate Demo Seams

These seams are intentional and should not be misread as bugs:

- global orbit truth is synthetic
- local handover logic is synthetic
- proxy-satellite positions are compressed into an elevated local sky corridor for readability
- beam values are narrative display values
- OSM Buildings are context geometry, not curated hero-scene assets

## 6. Repo Boundary

This repo still follows the Cesium boundary:

- configure Cesium
- wrap Cesium lightly
- do not fork or reimplement Cesium internals

But the product boundary has changed:

- the repo is no longer optimizing for an abstract phased Cesium foundation
- the repo is optimizing for a same-page demo of local handover presentation

## 7. Authority Order

When describing the repo's current intent, use this order:

1. `README.md`
2. `docs/local-handover-focus-demo-sdd.md`
3. `docs/local-focus-visual-refinement-sdd.md`
4. this file

When investigating Cesium runtime behavior, use:

1. `docs/cesium-evidence.md`
2. installed Cesium source under `node_modules/`
3. repo ADRs under `docs/decisions/`

`docs/delivery-phases.md` is now a historical/bootstrap continuity file, not the active roadmap.
