# Local Handover Focus Demo SDD

**Status:** Accepted demo-first canonical scope  
**Date:** 2026-04-19  
**Applies to:** `scenario-globe-handover-demo`  
**Primary goal:** Prove that one Cesium page can carry global orbit context plus a readable same-page local handover narrative — with a single UE anchor, UE↔satellite beam links, synthetic handover decision, synthetic beam-hopping effect, and pass-like overhead trajectory — without claiming physical or product-contract realism.

---

## 1. Purpose

This demo exists to answer one product question quickly:

**Can one Cesium page keep the Earth-scale satellite context visible while also staging a readable local handover scene — including a single UE anchor, UE↔satellite beam links, synthetic handover, synthetic beam hopping, and pass-like overhead trajectory — immediately after the user picks a site?**

This SDD is deliberately biased toward fast visual validation and demo narratability. It does **not** attempt to prove:

- realistic orbit truth
- realistic handover scheduler logic
- real beam geometry or RF accuracy
- real UE mobility, traffic, QoS, or KPI semantics
- product data contracts or cross-repo integration shapes

### 1.1 Reading order

This SDD is the canonical authority for **scene semantics** in this repo. `docs/local-focus-visual-refinement-sdd.md` is the supporting boundary note for **presentation polish only**. Other docs under `docs/` (delivery-phases, cesium-evidence, cesium-adoption-boundary, deployment-profiles) are historical Cesium provenance, not active product authority.

---

## 2. Repo Role & Boundary

`scenario-globe-handover-demo` is **demo-first**. Its boundary is:

- it demonstrates interaction grammar + visual narrative on one Cesium page
- it is **not** the roadmap authority for `scenario-globe-viewer` and does not redefine its Phase 7+
- it is **not** a spec source for `ntn-sim-core`; `ntn-sim-core` is only a visual benchmark
- it is **not** a realism track for orbit, RF, handover, or scheduler behavior
- it does **not** create cross-repo contracts
- it does **not** back-propagate demo logic into other repos' specs

This boundary is enforced by the explicit non-goals in §13 and the follow-on ordering in §14. Any pressure to weaken the boundary must go through a named blocker discussion, not a quiet expansion.

---

## 3. Problem Statement

A literal global-scale Cesium scene becomes unreadable at city scale:

- true LEO altitude keeps satellites far from the site; beam cues and role labels do not read
- a naive zoom from global to local scale collapses the narrative
- sending the user to a separate local simulator page breaks continuity and loses context

The demo must therefore stage a compressed, readable, **same-page** local scene that:

1. keeps the global orbit layer alive during local focus
2. anchors a single UE at the double-clicked site
3. renders UE↔satellite links for three role-bearing proxies
4. drives a synthetic handover narrative (role swap over time)
5. layers a synthetic beam-hopping cue on top of the active serving beam
6. renders overhead motion as a **pass-like sky trajectory** rather than static slots

All of this must remain readable enough for demo narration, and explicitly separated — section by section — into *semantic state* vs. *presentation cue*. Any compression is a **readability compression**, never a system specification.

---

## 4. Same-Page Scene Grammar

The scene is two coexisting layers rendered inside one Cesium `Viewer`.

### 4.1 Global orbit layer (always running)

- synthetic circular orbits; Earth rotation applied for plausibility
- orbit guide dots mark each orbit trace as a narrative aid, not a measurement
- shared `sat.glb` model
- continues animating regardless of local focus state

### 4.2 Local handover focus layer (activated on UE selection)

- appears above the selected UE anchor
- exactly three primary satellite proxies (serving / pending / context)
- UE↔satellite links and beam cones
- synthetic 4-phase handover loop
- synthetic beam-hopping cue modulating the serving beam only

### 4.3 Interaction contract

- `LEFT_DOUBLE_CLICK` on globe → UE anchor + local focus
- `NTPU` toolbar button → preset UE anchor at National Taipei University
- `Home` button → exit local focus, clear UE, restore global presentation
- sky toggle: local focus enters `space`; Home restores `blue`; the user may override manually

### 4.4 HUD

The HUD DOM surface exists but is **hidden by default**. It is an **optional explainer surface**, never a demo success requirement. If shown, it renders derived narration strings; it is not a scientific readout. Acceptance criteria (§12) never depend on the HUD being visible.

### 4.5 Global ↔ local coupling

- local focus **samples** the global layer's current satellite positions once per tick
- local focus **ranks** candidates around the UE and selects the top 3
- local focus **projects** ranking into stage-local arcs (see §6)
- local focus **does not** rewrite, pause, or re-time the global layer
- the global layer is authoritative for which satellites exist; the local layer is authoritative for how the three stage proxies appear

---

## 5. UE Model

### 5.1 Scope

- **exactly one UE anchor at a time**
- selecting a new site replaces the current UE; there is no UE list
- the UE is not a terminal entity; it is a **single presentation anchor**

### 5.2 UE state

| Field | Meaning |
|---|---|
| `positionM` | Cartesian WGS84 anchor |
| `latitudeDeg` / `longitudeDeg` | derived latitude / longitude |
| `surfaceHeightM` | picked surface height (clamped ≥ 0) |
| `selectedAt` | Julian clock time at selection |
| `selectedAtPerformanceMs` | local wall-clock anchor for presentation timing |
| `displayName?` | optional preset label (e.g. NTPU) |

### 5.3 Responsibilities

- fixes the local stage origin
- provides the east/north/up frame for proxy arcs, beam links, and beam cones
- triggers local focus activation and phase-loop timing restart
- drives the camera glide or fly into the local composition

### 5.4 Non-responsibilities (explicit)

- no UE mobility (the anchor is static until replaced)
- no UE traffic model, no QoS, no buffer, no KPI
- no UE-owned RF parameters (antenna gain, noise figure, Tx power)
- no multi-UE scheduling
- no UE identity, capability, or subscription state
- no service continuity contract (the UE cannot "hand over" in any protocol sense)

### 5.5 Visual representation

- site marker point + label (default `Selected Site`, or preset display name)
- site halo ring
- footprint ellipse for contextual reference

These are **presentation cues** marking where the UE anchor sits. They encode nothing about coverage, service area, or RF truth.

---

## 6. Local Sky-Pass Model

> **Readability compression notice.** Every concept in this section is a stage-local compression for readability. Arc shape, arc scale, arc cadence, and identity rotation cadence are **not** projections of real orbit geometry, real pass geometry, or real visibility truth. They are demo presentation derived from the current global-layer ranking.

### 6.1 Primary proxy count: 3

The local stage renders exactly three satellite proxies:

1. **serving** — current best-ranked candidate
2. **pending** — next candidate in the rotation
3. **context** — fading candidate (previous serving or trailing candidate)

#### Why three and not more

- Three is the minimal cast that tells the serving / pending / context story without visual noise.
- Additional proxies dilute the narrative without adding semantic payoff.
- Pass-like feel is achieved by **per-proxy arc trajectory + identity rotation**, not by increasing the headcount.
- Keeping three primary proxies is a **deliberate readability anchor**, not scope avoidance.
- Any future change to this count must go through a named blocker, not a silent expansion.

### 6.2 Pass-like trajectory (readability compression)

Each proxy's stage-local position follows a **compressed elliptical arc** in the UE's east/north/up frame:

- the arc rises from a stage-boundary foot, peaks near local zenith, and sets on the opposite foot
- the arc plane azimuth derives from the underlying global-layer candidate's azimuth at sampling time (preserves directional meaning)
- the arc scale is compressed — order 10³ m, not 10⁶ m
- the arc geometry is **not** a reprojection of the real satellite orbit or real pass track
- the arc position at time `t` is determined by `presentationElapsedSec` modulo the arc cycle

This is a readability construct. It is not a sky-visibility truth surface.

### 6.3 Arc phase staggering

The three proxies are offset by approximately one third of a full arc cycle so that, at any moment:

- one proxy is near peak (typically fills the serving role)
- one proxy is rising (candidate for pending)
- one proxy is setting (candidate for context)

### 6.4 Identity rotation (distinct from handover)

When a proxy's arc reaches its setting endpoint:

- its underlying satellite id is replaced by the next ranked candidate from the global layer
- its arc restarts from the rising endpoint
- this produces the "new overhead candidate entering" narrative without changing proxy count

**Identity rotation is a visual re-casting of a stage slot. It is not, by itself, a handover event.** See §6.6 and §8.3 for how the two are counted separately.

### 6.5 Role assignment

- role labels (serving / pending / context) come from the **ranking** of current candidates (elevation + range + score)
- role labels are re-derived per tick; they do not inherit from the previous tick
- in practice ranking correlates with arc phase (peak ≈ best), but the two remain logically decoupled
- a **handover** is the serving satellite id changing; the proxies themselves do not teleport

### 6.6 Identity rotation vs. handover event (authoritative separation)

| Phenomenon | Trigger | Visible effect | Counts as handover? |
|---|---|---|---|
| Identity rotation on a non-serving proxy | the pending or context proxy's arc reaches its setting endpoint | same stage slot shows a new satellite id; serving id unchanged | **No** |
| Role swap in `switching` phase | ranking change promotes pending to serving | the `SERVING` role label crosses between proxies; serving id changes | **Yes** |
| Identity rotation on the serving proxy (rare edge case) | arc phase staggering normally keeps the serving proxy near peak; if it ever wraps mid-role, this case applies | same stage slot shows a new satellite id; serving id changes | **Yes** |

The handover counter is governed by one unified rule (§8.3): `handoverCount` increments exactly when the serving satellite **id** differs from the serving id at the previous tick. Identity rotation on non-serving proxies does not satisfy this condition.

Implementations **must not** conflate identity rotation with the handover event. Any attempt to count "proxy id changed" as a handover is incorrect.

---

## 7. Link & Beam Model

> **Readability compression notice.** Link width, cone opacity, and glow are **presentation cues** encoding role. They do **not** encode RF power, EIRP, SINR, or coverage area.

### 7.1 UE↔satellite links

| Role | Width | Glow | Visibility |
|---|---|---|---|
| serving | 8 px | strong | always while local focus is active |
| pending | 6 px | medium | always; emphasized during `prepared` and `switching` phases |
| context | 3 px | faint | always; low emphasis |

Links are stage-local polylines from the UE anchor to the proxy stage position.

### 7.2 Beam cones

- serving cone: always rendered, brightest
- pending cone: always rendered, slightly larger / cooler
- context cone: rendered faintly
- cone bottom radius is exaggerated relative to stage building scale for readability
- cone orientation follows link direction (cone axis ≈ link direction)

### 7.3 Channel separation (cue orthogonality — hard constraint)

To keep handover cues and beam-hopping cues visually distinguishable (see §8, §9), the two phenomena must modulate **different visual channels**:

| Cue | Primary channel | Secondary channel |
|---|---|---|
| Handover (role swap) | **role color / label** — role color assignment, label cross-fade | link width |
| Beam hopping (BH) | **opacity / glow** on serving cone and serving link only | — |

Rules that follow from this separation:

- a BH dwell / guard cycle must **never** invoke a role color or label change
- a handover must **never** use pure opacity modulation as its primary channel
- BH must not modulate pending or context channels
- role labels must remain stable through the BH guard phase

This orthogonality is a hard constraint in implementation, not a suggestion.

### 7.4 Final visual tuning boundary

Final cone size, link width, glow parameters, and polish belong to `docs/local-focus-visual-refinement-sdd.md`. Any change to **semantic channel usage** (§7.3) must come back here first.

---

## 8. Synthetic Handover Decision Model

### 8.1 What is modelled

- a time-driven phase loop that rotates the serving role label among the three stage proxies
- a visual handover counter that increments when the serving satellite id changes across ticks

### 8.2 What is **not** modelled

- no time-to-trigger (TTT) threshold
- no hysteresis margin
- no A3 / A4 / A5 event semantics
- no measurement report path
- no RRC state machine
- no per-link SINR, RSRP, or RSRQ truth
- no conditional handover preparation
- no dual connectivity or DAPS contract
- no UE mobility state estimation

### 8.3 Trigger, gating, and counting rule

- **Trigger:** the cycle timer enters the `switching` phase window (see §10).
- **Gate:** the serving label visually swaps onto the pending proxy within `switching`.
- **Counting rule (unified):** `handoverCount` increments exactly when the serving satellite **id** differs from the serving id at the previous tick, regardless of the mechanism that produced the change.
  - Identity rotation on a non-serving proxy does not satisfy this condition and is not counted.
  - Identity rotation on the serving proxy is rare (arc staggering normally keeps it near peak); if it occurs it is counted, because the serving id changed.
- The swap is deterministic given `presentationElapsedSec` and the candidate ranking at that moment.

### 8.4 Presentation cues

- pending link and cone glow intensify during `prepared`
- role labels cross-fade during `switching`
- HUD phase label + progress bar update **if** the HUD is visible

All of the above are **narrative cues**, not scheduler state.

---

## 9. Synthetic Beam-Hopping Model

> **Readability compression notice.** The beam-hopping strobe is a presentation cue designed to suggest "the serving satellite time-shares beams." It is not a scheduler output, a hop pattern bank, or a coverage time-share truth. It never represents a real dwell schedule.

### 9.1 Meaning in this demo

Beam hopping is a **within-serving** time-share cue, **orthogonal to handover**:

- handover = which satellite serves the UE right now
- beam hopping = which beam on the serving satellite is illuminating the UE right now

In real NTN this is a scheduler output. In this demo it is a **repeating dwell-on / guard-off modulation** applied to the serving beam only.

### 9.2 Visual contract

- cadence is **clearly faster** than the HO phase cycle — suggested order 1–2 s per hop frame, with dwell ~60–70% and guard ~30–40%
- during **dwell:** the serving cone is fully visible; the serving link is at full glow
- during **guard:** the serving cone dims (with a non-zero floor — never fully invisible); the serving link tapers
- BH cadence does **not** interrupt the HO phase timer, role assignment, or candidate ranking
- BH does **not** modulate pending or context channels
- BH uses the **opacity / glow** channel only (see §7.3 channel separation)
- BH is the only cue permitted to use pure opacity modulation as its primary channel; handover must never do this

### 9.3 What is **not** modelled

- no real hop pattern bank
- no frequency-reuse semantics
- no dwell allocation algorithm
- no per-beam SINR, no coverage area truth
- no hop vs. steady-beam mode switch
- no time-domain resource block concept

### 9.4 HUD surface (optional)

If the HUD is shown, a BH indicator slot may surface on the serving card (e.g. a small strobe icon). It is **not** a demo success requirement and must never block acceptance.

---

## 10. Phase Contract

The handover phase loop is a single 8-second real-time cycle with four phases.

| Phase | Cycle window | On-stage event | State event |
|---|---|---|---|
| `tracking` | 0% – 42% | serving / pending / context stable; serving beam strobes BH | ranking held; proxies animate along their arcs |
| `prepared` | 42% – 72% | pending emphasized (glow, larger cone); context unchanged | ranking held; presentation bias toward pending |
| `switching` | 72% – 88% | role labels swap: pending → serving, serving → pending | HO counter increments at the serving-id change |
| `post` | 88% – 100% | previous serving retained as pending briefly, new serving settles | ranking recomputed for the next cycle |

### 10.1 State vs. presentation

- **State (persistent across ticks):**  
  UE anchor · proxy↔candidate binding · arc phase per proxy · current cycle index · handover count · last serving id
- **Presentation (derived per tick):**  
  phase · phase label · progress bar · link widths and glow · cone opacity · BH modulation state · HUD strings

### 10.2 Resets and transitions

- selecting a new UE resets: `selectedAtPerformanceMs`, `lastServingId`, `handoverCount`, all arc phases, HUD narration strings
- the Home button clears the UE and freezes the local stage until the next selection
- BH cadence and HO phase cadence both reset on UE selection and run independently from that point

---

## 11. Runtime & Data/Control Flow

```
[index.html]
  └── reserves CESIUM_BASE_URL

[src/main.ts]
  ├── initializeCesiumBootstrap()
  ├── createViewer()
  ├── mountAppShell()
  ├── createSyntheticConstellationRuntime(viewer)    // global layer
  ├── mountLightingToggle / SkyModeToggle / NtpuShortcut
  ├── createHandoverFocusDemoController(...)         // local layer
  └── mountOptionalOsmBuildingsShowcase()            // best-effort context

[clock.onTick]
  ├── global constellation.syncEntities(time)
  └── local focus.updateAtTime(time)
        ├── sample candidates from global layer
        ├── rank top 3
        ├── compute arc phase per proxy
        ├── map arc phase → proxy stage position
        ├── detect identity rotation (arc wrap on non-serving proxies)
        ├── compute HO phase from presentation time
        ├── compute BH modulation from presentation time
        ├── assign roles from ranking
        ├── apply proxies, links, cones (channel separation §7.3)
        ├── increment HO counter on serving id change (§8.3)
        └── sync HUD (if visible)
```

Input events:

- `LEFT_DOUBLE_CLICK` on globe → place a UE anchor at the picked position
- `homeButton.command.beforeExecute` → `clearUeAnchor()`
- `NTPU` preset → `placeUeAnchorAt(NTPU, { transition: "fly" })`

---

## 12. Acceptance Criteria

The demo is successful when **all** of the following hold. Items are visually observable; **none require HUD visibility**.

1. The global layer animates continuously during local focus — it does not pause on UE selection.
2. A double-click anywhere on Earth produces a single UE anchor and a local focus within 1.5 seconds.
3. The three proxy satellites visibly traverse compressed sky-pass arcs (rising → peak → setting), not static wobble in slots.
4. At any moment, at least one proxy is near peak, one is rising, and one is setting.
5. Identity rotation is visible over time — the same stage slot hosts different satellite ids as arcs complete.
6. A handover event (serving id change) occurs at least once per 8 s cycle and is readable without the HUD.
7. The serving beam cone exhibits a distinct BH cadence (on / off modulation) clearly faster than the HO phase timer.
8. The BH modulation is confined to the serving channel; it does **not** change role labels and does **not** increment the HO counter.
9. The Home button restores the global layer and clears the UE anchor.
10. Identity rotation and handover events are visually distinguishable without the HUD, via the channel separation in §7.3 (role color / label for HO, opacity / glow for BH).

### 12.1 HUD is optional

The HUD is an **optional explainer surface**, not a success gate. If hidden (the default), criteria 1–10 must still be satisfiable by visual observation alone. A demo session that never reveals the HUD is still a valid success.

---

## 13. Explicit Non-Goals

- TLE ingestion or real orbit propagation
- real ephemeris, SGP4, or any external orbit source
- real terrain-coupled site datasets
- formal site-owned 3D Tiles authoring
- matching `ntn-sim-core` asset fidelity (visual benchmark only)
- real UE mobility, traffic, QoS, or KPI
- real handover FSM or measurement reports
- TTT, hysteresis, A3 / A4 / A5, conditional handover, DAPS, or any 3GPP-like contract
- RF-accurate link budget, SINR, RSRP, or per-beam coverage area
- real scheduler output for beam hopping (no hop pattern bank, no dwell allocation)
- multi-UE simulation
- exported product contracts or cross-repo integration plans
- any back-propagation into `scenario-globe-viewer` phase definition
- any spec authority over `ntn-sim-core`

---

## 14. Follow-On Boundary

If and only if this demo's visual grammar is accepted, a realism track may replace synthetic seams in the following order. **Each step is a separate repo or project decision, not owned by this SDD.**

1. replace synthetic candidate ranking with a narrow truth surface (e.g. an ephemeris sampler)
2. replace synthetic global orbit generation with an external orbit source (TLE / SGP4)
3. replace stage-local arcs with a physically projected sky-track, while keeping stage compression as a selectable mode
4. replace presentation-only HO cues with a documented HO FSM
5. replace presentation-only BH strobe with a documented scheduler adapter
6. only then consider multi-UE or external data contracts

Until that realism track is formally opened, this SDD — together with `docs/local-focus-visual-refinement-sdd.md` for presentation polish — remains the authority for the demo's scene semantics and presentation shape.
