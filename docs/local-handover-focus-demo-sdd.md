# Local Handover Focus Demo SDD

**Status:** Accepted demo-first scope  
**Date:** 2026-04-17  
**Applies to:** `scenario-globe-handover-demo`  
**Primary goal:** Validate the visual grammar of `global orbit view + same-page local handover focus`

## 1. Purpose

This demo exists to answer one product question quickly:

**Can one Cesium globe keep the Earth-scale satellite context visible while also presenting a
readable handover scene immediately after the user selects a site on the globe?**

This SDD is intentionally biased toward fast visual validation.

It does **not** attempt to prove:

- realistic orbit truth
- realistic handover decision logic
- real beam geometry semantics
- real deployment data contracts

## 2. Problem Statement

A literal global-scale Cesium scene becomes unreadable when the camera is pushed down toward
city scale:

- real LEO altitude keeps satellites too far from the site for beam and handover cues to read
- a direct zoom from global scale to local scale collapses the narrative
- the user loses either the global context or the local continuity story

The demo therefore rejects two extremes:

1. global-only truth with no readable local handover staging
2. separate page navigation into a disconnected local simulator scene

## 3. Decision

The demo will use **single-page, dual-scale presentation**:

1. a **global orbit layer**
   - synthetic satellites orbit around the Earth in the main Cesium scene
2. a **site selection layer**
   - double-clicking the Earth chooses a local anchor point
3. a **local handover focus layer**
   - the same page spawns an enlarged site-stage presentation above the chosen point
4. an **optional demo HUD surface**
   - explanatory panels may exist, but they are not required to be visible by default

## 4. Key Architectural Rule

The local handover focus layer is **not** a physically accurate zoom of the global layer.

Instead, it uses **narrative proxy satellites**:

- their identities come from the strongest synthetic candidates around the selected site
- their local azimuth/elevation are derived from the global orbit layer
- their local positions are compressed into a readable site-stage envelope

This keeps continuity between global and local views without pretending that a literal scale
transition will stay readable.

## 5. Demo Scope

### 5.1 In Scope

- Cesium native `Viewer`
- animated synthetic satellites with orbit guide dots
- Cesium OSM Buildings as a best-effort city-scale context layer
- double-click-to-select site on the globe
- NTPU preset shortcut for repeatable demo entry
- camera flight into a local site view
- procedural site massing blocks
- serving / pending / context proxy satellites above the site
- beam links and translucent beam cones
- sky-mode switch to emphasize local-focus entry
- synthetic handover phase loop:
  - tracking
  - prepared
  - switching
  - post-handover settle

### 5.2 Out of Scope

- TLE ingestion
- real terrain-coupled site datasets
- formal site-owned 3D Tiles datasets
- real handover FSMs
- realistic beam steering constraints
- packet-, KPI-, or RF-accurate values
- exported downstream contracts

## 6. Data Model

The demo uses three lightweight state surfaces.

### 6.1 Synthetic Constellation

Each global satellite has:

- id / label
- altitude
- inclination
- RAAN
- phase
- period
- display color

The orbit model is circular and synthetic. Earth rotation is applied only to keep the visual
motion plausible.

### 6.2 Site Selection

Each selected site stores:

- fixed Cartesian world position
- latitude / longitude
- picked height
- selection timestamp

### 6.3 Demo Frame

Each local-focus update produces:

- serving candidate
- pending candidate
- context candidate
- current demo phase
- current progress inside the phase loop
- recent-event text

## 7. Runtime Flow

1. App boots Cesium and enables clock animation.
2. Synthetic constellation runtime creates global orbit entities and updates them on clock ticks.
3. OSM Buildings may attach asynchronously through Cesium's native loader when available.
4. User double-clicks Earth.
5. Site-selection runtime resolves the clicked point to a world-space anchor.
6. Camera transitions toward the selected site.
7. Local focus runtime:
   - samples the current synthetic constellation
   - ranks the best candidates around the selected site
   - compresses those candidates into a readable local stage
   - updates proxy satellites, beam links, beam cones, and HUD text
8. Entering local focus may switch the scene into a space-sky presentation mode.
9. User may clear the site focus through the native Home button and return to the shared global view.

## 8. Presentation Rules

### 8.1 Global Layer

- keep the globe readable from far range
- show orbit guide dots and labels
- use the shared `sat.glb` model
- allow an optional native Cesium OSM Buildings context layer to coexist without changing the local handover logic

### 8.2 Local Focus Layer

- keep only three proxy satellites active:
  - serving
  - pending
  - context
- exaggerate readability over realism
- preserve directional meaning:
  - higher elevation should feel closer to zenith
  - azimuth should still influence local placement

### 8.3 HUD

The HUD is explanatory, not scientific.

The displayed values may look like RF metrics, but in this prototype they are only narrative
signals derived from the synthetic ranking path.

The HUD surface is also optional. The current repo state keeps the DOM surface available while
hiding the panels by default.

## 9. Validation Standard

This prototype is successful if all of the following are true:

1. the user can understand that the global satellites remain in orbit
2. the user can click any site and immediately get a local handover scene
3. the serving / pending transition reads clearly without leaving the page
4. the visual language is compelling enough to justify a realism follow-on

This prototype is **not** blocked on:

1. realistic beam semantics
2. real candidate selection
3. real satellite visibility truth
4. data-source interoperability

## 10. Follow-On Boundary

If the visual grammar is accepted, the next follow-on should replace the synthetic seams in this order:

1. replace synthetic candidate ranking with a dedicated narrow truth surface
2. replace synthetic global orbit generation with an external orbit source
3. replace procedural site massing with repo-owned site datasets or 3D tiles
4. only then discuss consumer contracts or realistic handover integration
