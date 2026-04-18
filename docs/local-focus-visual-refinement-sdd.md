# Local Focus Visual Refinement SDD

**Status:** Accepted current-boundary note  
**Date:** 2026-04-18  
**Applies to:** `scenario-globe-handover-demo`  
**Primary goal:** Improve the same-page local focus presentation without leaving Cesium's native runtime or introducing heavy site-authoring workflows

## 1. Context

The baseline demo proved that one Cesium page can do all of the following at once:

- keep a global orbit layer alive
- let the user double-click any site on Earth
- fly into a local handover focus
- stage proxy satellites and beam cues above that site

The next question is narrower:

**How far can the local-focus presentation be improved while staying immediate, same-page, and lightweight?**

## 2. What We Learned

The current repo has two important constraints:

1. `ntn-sim-core` looks refined because it uses a curated local scene asset, a fixed presentation camera, and tuned materials.
2. Cesium native globe imagery plus `createOsmBuildingsAsync()` does not provide that kind of hero-scene quality by default.

This means a direct attempt to make raw Cesium OSM look like `ntn-sim-core` is the wrong target.

## 3. Decision

The refinement track will keep the existing same-page dual-scale design, but it will treat Cesium and OSM as **context geometry**, not as a handcrafted hero asset.

The demo will therefore optimize for:

- stronger airborne-oblique composition
- clearer foreground/background separation
- better emphasis on the selected site, proxy satellites, and beam narrative
- no page transition
- no long-running per-site generation workflow

This document now serves as the current boundary note for the repo, not just a future-looking
follow-on. In practice that means:

- the cleanup slice rejecting fake site-deck imagery has already landed
- the local focus interaction contract is already active
- remaining polish work should stay presentation-only unless the repo explicitly reopens for realism work

## 4. Explicit Non-Goals

This refinement track will **not** do any of the following:

- Blender-driven site generation at click time
- long-running local mesh extraction or authoring
- fake ortho/photo deck overlays that do not match the real underlying site
- claims that raw OSM Buildings can fully match `ntn-sim-core` scene quality
- replacing the globe with a separate local simulator page

## 5. Presentation Boundary

### 5.1 Cesium + OSM Ceiling

The native Cesium + OSM route can provide:

- real geographic continuity
- immediate site selection anywhere on the globe
- believable city-scale context
- lightweight building massing and terrain context

It cannot, by itself, guarantee:

- handcrafted scene composition
- tuned local textures and materials
- scene-specific geometry cleanup
- the same finish level as a purpose-built local asset

### 5.2 Practical Target

The realistic target is therefore:

**approach the readability and composition of the local `ntn-sim-core` scene without claiming the same asset quality**

In other words, the focus is to get closer to the feel of `Image #2`, not to reproduce the exact asset fidelity of `Image #1`.

## 6. Accepted Refinement Strategy

The next slices should improve only the presentation layer:

1. remove misleading synthetic ground overlays
2. preserve the clicked site as the center of the local composition
3. keep the airborne-oblique camera rig stable and repeatable
4. let raw OSM and globe imagery recede into background context
5. concentrate visual emphasis on:
   - proxy satellites
   - serving / pending beam cones
   - the selected site marker and local stage

## 7. Landed Cleanup Slice

The first refinement slice was intentionally small:

1. remove the rejected fake site-deck overlay
2. restore the local stage so it sits directly on top of the real Cesium scene
3. keep the current same-page interaction and airborne-oblique camera

This slice is now part of the current repo baseline. It was a cleanup step, not a final polish pass.

## 8. Success Criteria

This refinement track is on the right path if:

1. the local focus still appears instantly after double-click
2. the clicked location remains the center of the local composition
3. the ground no longer contains fake texture plates that break geographic continuity
4. the scene still reads as one continuous Cesium world
5. later visual polish can be added without changing the interaction contract

## 9. Follow-On Order

After the cleanup slice, later work should only explore lightweight presentation improvements such as:

1. stronger local contrast and deemphasis of distant context
2. clearer satellite/beam hierarchy in the upper half of the frame
3. restrained styling changes for context geometry
4. optional local-focus-only atmosphere, fog, or tint controls if they stay fast and reversible

If those steps still do not reach the target quality, the remaining gap should be treated as a data/asset limitation rather than hidden with fake local imagery.

## 10. Current Freeze Point

The repo can currently be treated as a valid demo checkpoint because it already demonstrates:

1. globe-scale orbit context
2. same-page local focus entry
3. preset-site entry through NTPU
4. local proxy-satellite staging without page navigation

The remaining gap is mostly visual fidelity, not interaction viability.
