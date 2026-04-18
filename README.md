# scenario-globe-handover-demo

`scenario-globe-handover-demo` is a Cesium-based demo repo for one narrow product question:

**Can one globe scene keep believable global satellite motion visible while also staging a readable local handover scene on the same page after the user picks a site?**

This repo is now explicitly **demo-first**. It is no longer being described as an active
`Cesium Phase 2.7` implementation track. The Cesium bootstrap, home-camera, provider, and
runtime-evidence documents are still kept in-repo because the demo depends on those baseline
choices, but the active repo story is now:

- global orbit context
- same-page local handover focus
- synthetic visual narrative before realism work

## Current Demo Scope

- keep Cesium on the native `Viewer` path
- preserve a global orbit layer with moving satellite models and orbit guide dots
- let the user double-click any point on the Earth to create a local handover focus
- provide an `NTPU` preset shortcut for quick repeatable demos
- reuse `public/models/sat.glb` in both global and local layers
- mount Cesium OSM Buildings as a best-effort city-scale context layer by default
- keep the local scene synthetic:
  - serving / pending / context proxy satellites
  - beam links and translucent cones
  - synthetic phase loop and text narrative

## What This Repo Does Not Claim

- real orbit ingestion
- real handover decision logic
- real beam-steering semantics
- RF-accurate values
- `ntn-sim-core`-level local asset fidelity

The point of this repo is to validate the **interaction grammar** and **presentation shape**
before spending time on realism or asset-authoring work.

## Demo Interaction

1. Start the app with `npm run dev`.
2. Wait for the native Cesium globe shell to load.
3. Use one of these entry points:
   - double-click any site on Earth
   - click the `NTPU` toolbar button to jump to `National Taipei University, Taiwan`
4. The demo enters a local focus on the same page:
   - the camera moves into a closer local composition
   - the sky switches to `space` mode
   - enlarged proxy satellites appear above the selected site
   - serving / pending / context beams stage a synthetic handover loop
5. Use the native `Home` button to clear local focus, return to the wide globe view, and restore blue-sky mode.

Other toolbar controls:

- `sun` button: toggle day/night globe lighting
- `sky` button: toggle blue-sky mode vs space-sky mode

If you need to disable OSM Buildings temporarily, open the app with:

- `?buildingShowcase=off`

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check and build the demo |
| `npm test` | Run the build-verification bundle |
| `npm run test:phase1` | Run the browser bootstrap smoke after building |
| `npm run preview` | Preview the built artifact locally |

`npm test` and `npm run test:phase1` keep their older script names for compatibility, but
they should now be read as **verification commands**, not active project phases.

## Runtime Layout

The current runtime is split into six narrow surfaces:

- `Cesium bootstrap + native Viewer shell`
- `globe baseline`
  - home camera language
  - imagery / terrain selection
  - lighting
  - sky mode
- `synthetic constellation`
  - global satellites
  - orbit guide dots
- `local handover focus`
  - site picking
  - compressed proxy-satellite stage
  - beam cues
- `toolbar shortcuts`
  - sky toggle
  - lighting toggle
  - NTPU preset
- `optional OSM context`
  - Cesium-native `createOsmBuildingsAsync()` path

The left and right demo HUD panels still exist in the DOM for future refinement, but they are
currently hidden by default.

## Authority Docs

Read these first when updating the demo:

- `docs/local-handover-focus-demo-sdd.md`
- `docs/local-focus-visual-refinement-sdd.md`
- `docs/architecture.md`

Use these as Cesium provenance and bootstrap references, not as the active product story:

- `docs/cesium-evidence.md`
- `docs/cesium-adoption-boundary.md`
- `docs/deployment-profiles.md`
- `docs/delivery-phases.md`

`docs/delivery-phases.md` is now retained mainly as a **historical Cesium bootstrap record**.
It is no longer the repo's active implementation roadmap.

## Current Validation Standard

This demo is successful if it demonstrates all of the following:

- the globe still reads as a global satellite scene
- any clicked site can become a local handover focus without page navigation
- the local proxy satellites and beams are readable enough to discuss interaction design
- the repo gives a useful checkpoint for deciding whether realism work is worth starting

This demo is not blocked on realistic orbit truth, realistic RF truth, or final asset polish.
