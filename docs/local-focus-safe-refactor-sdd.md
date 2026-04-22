# Local Focus Safe Refactor SDD

**Status:** Accepted engineering guardrail  
**Date:** 2026-04-21  
**Applies to:** `scenario-globe-handover-demo`  
**Primary goal:** Make the local-focus runtime safe to refactor without changing the repo's accepted single-Viewer scene grammar, demo interaction contract, or Cesium-native runtime boundary.

---

## 1. Purpose

This document is an **engineering refactor plan**, not a new product-spec surface.

It exists because the current repo has already proven the demo interaction, but the
main local-focus implementation is now concentrated inside one large controller file.
That concentration raises change risk even when the intended behavior is already
well-defined by the canonical demo SDD.

This document therefore defines:

- what behavior must stay fixed during cleanup
- which regressions must be covered before structural changes begin
- which code seams should be extracted first
- which stale or dormant surfaces are candidates for removal only after coverage exists

This document does **not** redefine scene semantics owned by:

- `docs/local-handover-focus-demo-sdd.md`
- `docs/local-focus-visual-refinement-sdd.md`

### 1.1 Progress Note

2026-04-21: Phase B started by extracting the local-focus pure model/state layer
into `src/features/demo/local-handover-model.ts`. Cesium entity mutation,
camera movement, picking interception, and controller lifecycle remain in
`handover-focus-demo.ts`.

2026-04-21: Phase C-1 extracted stage-entity construction, shell mutation, and
local-focus render mutation into `src/features/demo/local-handover-renderer.ts`.
`handover-focus-demo.ts` now retains controller orchestration, camera movement,
pick interception, and 3D Tiles passthrough selection.

2026-04-21: An isolated hardening slice moved 3D Tiles InfoBox property rendering
behind escaped text serialization in `src/features/demo/tile-feature-infobox.ts`
and added a focused regression for hostile metadata strings.

2026-04-21: Phase C-2 extracted local-focus camera framing and glide/fly logic
into `src/features/demo/local-handover-camera.ts`. `handover-focus-demo.ts`
now retains controller orchestration, selection passthrough, and UE-anchor
placement flow wiring.

2026-04-21: Phase C-3 extracted stage-overlay selection passthrough and 3D Tiles
selection entity wiring into `src/features/demo/local-handover-selection.ts`.
`handover-focus-demo.ts` is now reduced to controller lifecycle, tick/update,
and input wiring.

2026-04-21: Phase D cleanup removed unreferenced `src/core/cesium/credits.ts`
and `src/features/globe/fog-and-post-process.ts`, and dropped dormant local-focus
building-box / footprint / site-halo scaffolding that was no longer part of the
accepted demo contract.

---

## 2. Current Risk Summary

### 2.1 Monolithic local-focus controller

`src/features/demo/handover-focus-demo.ts` currently owns all of the following:

- UE-anchor normalization
- constellation candidate evaluation
- corridor-lane state
- handover truth derivation
- shell-text derivation
- Cesium entity creation
- Cesium render mutation
- beam and label styling
- camera glide / fly logic
- left-click / double-click interception
- 3D Tiles feature passthrough selection

This concentration increases the chance that a visually small tweak will accidentally
change ranking, phase timing, camera feel, or input behavior.

### 2.2 Coverage gap

Before this refactor-guardrail document landed, repo-local validation covered:

- bootstrap success
- worker / asset availability
- native viewer readiness

It did **not** sufficiently lock:

- `NTPU` preset entry into local focus
- local-focus state after entry
- `Home` clearing local focus
- sky-mode persistence across local-focus exit
- double-click entry back into local focus from the wide globe

### 2.3 Known contract drift that must not spread

The current repo had at least one already-confirmed doc/runtime drift:

- docs describe sky mode as a user-owned preference
- runtime reset it to `blue` during `Home`

Refactor work must reduce these mismatches, not preserve them by accident.

### 2.4 Stale or dormant code paths exist

The repo currently contains some surfaces that may be historical, dormant, or only
partially wired. They are not automatically safe to delete. They require coverage
first, then explicit removal.

---

## 3. Non-Goals

This refactor plan will **not**:

- introduce a second Cesium `Viewer`
- split the repo into a separate local-scene runtime
- change the accepted three-proxy cast
- change the accepted handover / beam-hopping phase grammar
- pursue realism work for orbit, RF, scheduler, or UE behavior
- replace Cesium-native controls with a repo-local shell
- start a visual redesign of the demo

If any of those become necessary, that is a separate scope decision and must be
handled explicitly in the canonical product-facing docs.

---

## 4. Non-Negotiable Runtime Invariants

Any safe refactor in this repo must preserve all of the following:

1. One Cesium page, one Cesium `Viewer`
2. Global synthetic orbit layer remains alive while local focus is active
3. Local focus still enters through:
   - `LEFT_DOUBLE_CLICK` on the globe
   - `NTPU` preset shortcut
4. `Home` still exits local focus and clears the active UE anchor
5. Sky mode remains a user-controlled preference; local focus entry and exit must not silently override it
6. The local cast remains:
   - exactly three primary proxies
   - serving / pending / context role grammar
   - resident serving cue
   - preview-only pending cue during `prepared` / `switching`
   - no UE link for context
7. The local sky-corridor motion model remains the accepted compressed presentation model rather than a physically literal sky pass
8. The repo stays on Cesium-native `Viewer` / provider / toolbar paths

---

## 5. Required Regression Coverage Before Structural Refactor

The refactor baseline must keep automated coverage for these interactions:

### 5.1 Bootstrap baseline

- app reaches `data-bootstrap-state="ready"`
- native Cesium viewer shell mounts
- lighting toggle mounts

### 5.2 NTPU preset path

- clicking the `NTPU` shortcut enters local focus
- local-focus shell state becomes active
- serving / pending values become populated
- local density lookup resolves the expected background count for NTPU latitude

### 5.3 `Home` exit path

- clicking `Home` clears local focus
- local-focus shell state returns to the no-selection baseline

### 5.4 Sky-mode persistence

- if the user switches to `space` before entering local focus
- then enters local focus
- then exits with `Home`
- the sky mode must still be `space`

### 5.5 Double-click path

- after returning to the wide globe
- a center-screen double-click must re-enter local focus

### 5.6 Refactor acceptance gate

No structural refactor is complete unless the above coverage remains green on the
same build artifact path used by the repo's smoke commands.

---

## 6. Proposed Extraction Order

Refactor work should proceed in the following order.

### 6.1 Phase A: Guardrails first

- land the interaction regression smoke
- fix already-confirmed contract drift
- do not move large code blocks yet

### 6.2 Phase B: Extract pure state / math surfaces

First extractions should be logic that does not require direct Cesium mutation:

- local-focus types
- candidate evaluation
- lane rotation and traverse-phase logic
- truth-frame derivation
- shell-frame derivation

These modules should stay pure or near-pure wherever possible.

### 6.3 Phase C: Extract Cesium adapters

Only after Phase B should the repo split the imperative Cesium path into narrower
adapters such as:

- stage entity factory
- local-focus renderer
- beam renderer
- camera pose / transition helpers
- picking / selection passthrough helpers

### 6.4 Phase D: Remove stale paths

Only after Phases A-C are green should the repo remove dormant code.

---

## 7. Cleanup Inventory

The following surfaces should be treated as explicit cleanup candidates.

### 7.1 Dormant app surfaces

Removed on 2026-04-21:

- `src/core/cesium/credits.ts`
- `src/features/globe/fog-and-post-process.ts`

### 7.2 Local-focus dormant demo scaffolding

Removed on 2026-04-21:

- `SHOW_DEMO_BUILDING_BOXES`
- `BUILDING_LAYOUT`
- stage-building entity creation kept only for that disabled flag
- dormant site halo / footprint stage entities not present in the accepted demo contract

### 7.3 Candidate / proxy derivation overlap

`evaluateCandidate()` currently computes a slot-style `proxyPositionM`, but the
accepted local-focus runtime later overwrites proxy positions with corridor-derived
positions. That overlap should be reconciled so one layer owns candidate truth and
another owns presentation projection.

### 7.4 Orbit-highlight leftovers

The synthetic-constellation runtime still exposes preview / highlight support that
the current local-focus controller does not actively use. That path should be either:

- restored as an intentional feature with coverage
- or removed as dead weight

### 7.5 Doc / runtime mismatch inventory

The current code/docs mismatch list must stay visible during cleanup, including:

- sky-mode persistence behavior
- `selectedAtPerformanceMs` documented state vs. current runtime timing storage

---

## 8. Security And Safety Notes

Refactor work must not silently preserve unsafe HTML pathways just because they are
currently convenient.

In particular, any HTML assembled from 3D Tiles metadata or external feature fields
must be treated as untrusted content unless proven otherwise.

If that path remains in the runtime, it should be reviewed and either:

- escaped
- sanitized
- or downgraded to plain-text rendering

This is a follow-on hardening slice, but the refactor must keep it visible.

---

## 9. File-Structure Target

This document does not force exact filenames, but the target shape should move
toward a structure where no single local-focus module owns all concerns at once.

An acceptable end state would separate:

- `local-focus-types`
- `local-focus-candidate-eval`
- `local-focus-lanes`
- `local-focus-truth`
- `local-focus-shell`
- `local-focus-entities`
- `local-focus-renderer`
- `local-focus-camera`
- `local-focus-controller`

The controller should orchestrate the flow rather than own every detail directly.

---

## 10. Acceptance Criteria

This refactor guardrail is satisfied when all of the following are true:

1. The repo has browser-level interaction coverage for the accepted local-focus flow
2. The already-confirmed sky-mode contract drift is fixed
3. The safe-refactor document is discoverable from repo docs
4. Follow-on structural cleanup can proceed without first re-discovering the risk inventory

This document does **not** require the large code split to happen immediately. It
establishes the minimum safe baseline before that split begins.
