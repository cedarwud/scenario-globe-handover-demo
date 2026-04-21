# Local Handover Focus Demo SDD

**Status:** Accepted demo-first canonical scope
**Date:** 2026-04-21
**Applies to:** `scenario-globe-handover-demo`  
**Primary goal:** Prove that one Cesium page can carry global orbit context plus a readable same-page local handover narrative — with a single UE anchor, UE↔satellite beam links, synthetic handover decision, synthetic beam-hopping effect, and an elevated local sky corridor traverse — without claiming physical or product-contract realism.

---

## 1. Purpose

This demo exists to answer one product question quickly:

**Can one Cesium page keep the Earth-scale satellite context visible while also staging a readable local handover scene — including a single UE anchor, UE↔satellite beam links, synthetic handover, synthetic beam hopping, and an elevated local sky corridor traverse — immediately after the user picks a site?**

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
3. renders one resident serving UE↔satellite link plus a preview-only pending candidate cue while leaving the context proxy unlinked
4. drives a synthetic handover narrative (role swap over time)
5. layers a synthetic beam-hopping cue on top of the active serving beam
6. renders local sky motion as an **elevated lateral traverse** rather than an observer-sky rise/set pass or static slots

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
- keeps those proxies inside a shared elevated local sky corridor
- one resident serving UE link / cone plus a phase-gated pending preview cue
- synthetic 4-phase handover loop
- synthetic beam-hopping cue modulating the serving beam only

### 4.3 Interaction contract

- `LEFT_DOUBLE_CLICK` on globe → UE anchor + local focus
- `NTPU` toolbar button → preset UE anchor at National Taipei University
- `Home` button → exit local focus, clear UE, restore global presentation
- sky toggle: `blue` or `space` remains a user-controlled scene preference; local focus entry does not auto-switch it

### 4.4 HUD

The HUD DOM surface exists but is **hidden by default**. It is an **optional explainer surface**, never a demo success requirement. If shown, it renders derived narration strings; it is not a scientific readout. Acceptance criteria (§12) never depend on the HUD being visible.

### 4.5 Global ↔ local coupling

- local focus **samples** the global layer's current satellite positions once per tick
- local focus **ranks** candidates around the UE and selects the top 3
- local focus **projects** ranking into an elevated local sky corridor (see §6)
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
- provides the east/north/up frame for proxy lanes, beam links, and beam cones
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

## 6. Local Sky-Corridor Model

> **Readability compression notice.** Every concept in this section is a stage-local compression for readability. Corridor height, lateral span, lane spacing, vertical wobble, and identity-rotation cadence are **not** projections of real orbit geometry, real pass geometry, or real visibility truth. They are demo presentation derived from the current global-layer ranking. Unless stated otherwise below, "the corridor" means the shared elevated local sky corridor used by all three proxies.

### 6.1 Primary proxy count: 3

The local stage renders exactly three satellite proxies:

1. **serving** — current best-ranked candidate
2. **pending** — next candidate in the rotation
3. **context** — fading candidate (previous serving or trailing candidate)

#### Why three and not more

- Three is the minimal cast that tells the serving / pending / context story without visual noise.
- Additional proxies dilute the narrative without adding semantic payoff.
- Readability comes from **shared sky corridor + role clarity + identity rotation**, not from increasing the headcount.
- Keeping three primary proxies is a **deliberate readability anchor**, not scope avoidance.
- Any future change to this count must go through a named blocker, not a silent expansion.

### 6.2 Elevated lateral traverse (readability compression)

Each proxy's stage-local position follows a **compressed traverse** inside a shared elevated local sky corridor in the UE's east/north/up frame:

- each proxy remains visibly in the sky; it must not appear to emerge from the ground, local terrain, or skyline
- motion is predominantly lateral or shallow-diagonal across the upper half of the composition
- slight vertical motion is allowed, but it is subordinate to the lateral traverse and must not read as a full rise → peak → set pass
- the corridor is front-facing: implementation compresses raw candidate azimuth into one readable left-to-right traverse, and candidate azimuth may influence only left/right lane ordering or lane bias inside that corridor
- the corridor is implemented as three parallel lanes sharing the same lateral traverse, not as three unrelated sky paths
- the corridor scale is compressed — order 10³ m, not 10⁶ m
- the corridor geometry is **not** a reprojection of the real satellite orbit or real pass track
- the proxy position at time `t` is determined by `presentationElapsedSec` modulo the traverse cycle

This is a readability construct. It is not a sky-visibility truth surface.

### 6.3 Lane and phase staggering

The three proxies are offset along the shared traverse cycle so that, at any moment:

- one proxy is near readable center (typically fills the serving role)
- one proxy is approaching or entering the readable center band (candidate for pending)
- one proxy is trailing toward an exit edge (candidate for context)
- the **readable center window** is the middle third of the corridor span; the serving proxy should normally stay inside that window during `tracking` and most of `prepared`
- under the stable local framing boundary described in `docs/local-focus-visual-refinement-sdd.md` §6, the cast should read as a simultaneous three-satellite sky band rather than a one-at-a-time pop-in sequence

### 6.4 Identity rotation (distinct from handover)

When a proxy reaches its corridor exit edge:

- its underlying satellite id is replaced by the next ranked candidate from the global layer
- it re-enters from the opposite edge of the same lane while staying visibly in the sky (exit right → re-enter left, exit left → re-enter right)
- if alternative candidates are available in the current ranked pool beyond the three already bound on stage, implementation should prefer a different id from the one that just exited so the local cast does not appear stuck
- this produces the "new candidate joining the local corridor cast" narrative without changing proxy count

**Identity rotation is a visual re-casting of a stage lane. It is not, by itself, a handover event.** See §6.6 and §8.3 for how the two are counted separately.

### 6.5 Role assignment

- role labels (serving / pending / context) come from the **ranking** of current candidates (elevation + range + score)
- role labels are re-derived per tick; they do not inherit from the previous tick
- in practice ranking usually correlates with corridor prominence (readable center ≈ best), but the two remain logically decoupled
- a **handover** is the serving satellite id changing; the proxies themselves do not teleport

### 6.6 Identity rotation vs. handover event (authoritative separation)

| Phenomenon | Trigger | Visible effect | Counts as handover? |
|---|---|---|---|
| Identity rotation on a non-serving proxy | the pending or context proxy reaches a corridor exit edge | same stage lane is re-cast with a new satellite id; serving id unchanged | **No** |
| Role swap in `switching` phase | ranking change promotes pending to serving | the `SERVING` role label crosses between proxies; serving id changes | **Yes** |
| Identity rotation on the serving proxy (rare edge case) | traverse staggering normally keeps the serving proxy away from exit during the readable center window; if it exits mid-role, this case applies | same stage lane is re-cast with a new satellite id; serving id changes | **Yes** |

The handover counter is governed by one unified rule (§8.3): `handoverCount` increments exactly when the serving satellite **id** differs from the serving id at the previous tick. Identity rotation on non-serving proxies does not satisfy this condition.

Implementations **must not** conflate identity rotation with the handover event. Any attempt to count "proxy id changed" as a handover is incorrect.

---

## 7. Link & Beam Model

> **Readability compression notice.** Link width, cone opacity, and glow are **presentation cues** encoding role. They do **not** encode RF power, EIRP, SINR, or coverage area.

### 7.1 UE↔satellite links

| Role | Line grammar | Visibility |
|---|---|---|
| serving | strongest solid link | always while local focus is active |
| pending / candidate | preview-style link (default: dashed or equivalently non-service grammar) | only during `prepared` and `switching` |
| context | no UE link | never |

When present, links are stage-local polylines from the UE anchor to the proxy stage position. The preview-only pending link must read as **candidate preparation**, not as a second resident service path.

### 7.2 Beam cones and tags

- serving cone: always rendered, brightest
- pending cone: rendered only during `prepared` and `switching`; cooler / more translucent than serving so it reads as a preview cue
- context cone: not rendered
- serving beam tag: always rendered
- pending beam tag: rendered only while the pending preview cue is visible
- context beam tag: not rendered
- cone bottom radius is exaggerated relative to stage building scale for readability
- cone orientation follows link direction (cone axis ≈ link direction)

### 7.3 Channel separation (cue orthogonality — hard constraint)

To keep handover cues and beam-hopping cues visually distinguishable (see §8, §9), the two phenomena must modulate **different visual channels**:

| Cue | Primary channel | Secondary channel |
|---|---|---|
| Handover (role swap / preparation) | **role color / label** — role color assignment, label cross-fade, preview-cue appearance for the pending candidate | serving vs. preview link grammar |
| Beam hopping (BH) | **opacity / glow** on serving cone and serving link only | — |

Rules that follow from this separation:

- a BH dwell / guard cycle must **never** invoke a role color or label change
- a handover must **never** use pure opacity modulation as its primary channel
- BH must not modulate pending or context channels
- role labels must remain stable through the BH guard phase
- the context role must not regain a UE-coupling cue outside an explicit SDD change

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
  - Identity rotation on the serving proxy is rare (traverse staggering normally keeps it away from exit during the readable center window); if it occurs it is counted, because the serving id changed.
  - the first frame after UE selection establishes the baseline serving id and does **not** increment `handoverCount`
- The swap is deterministic given `presentationElapsedSec` and the candidate ranking at that moment.

### 8.4 Presentation cues

- the pending preview link, cone, and beam tag appear during `prepared` and remain visible through `switching`
- the pending preview cue resolves into the next serving cue during `switching`
- role labels cross-fade during `switching`
- the context proxy remains visible in the corridor but unlinked to the UE
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
| `tracking` | 0% – 42% | serving / pending / context stable in the shared sky corridor; only the serving UE link / cone / tag are resident; serving beam strobes BH | ranking held; proxies animate along their traverses |
| `prepared` | 42% – 72% | a preview-style pending UE cue appears; context stays unlinked | ranking held; presentation bias toward pending |
| `switching` | 72% – 88% | role labels swap and the pending preview resolves into the new serving cue | HO counter increments at the serving-id change |
| `post` | 88% – 100% | the new serving cue remains resident; previous serving stays on stage briefly as an unlinked proxy | ranking recomputed for the next cycle |

### 10.1 State vs. presentation

- **State (persistent across ticks):**  
  UE anchor · proxy↔candidate binding · traverse phase per proxy · current cycle index · handover count · last serving id
- **Presentation (derived per tick):**  
  phase · phase label · progress bar · link widths and glow · cone opacity · BH modulation state · HUD strings

### 10.2 Resets and transitions

- selecting a new UE resets: `selectedAtPerformanceMs`, `lastServingId`, `handoverCount`, all traverse phases, HUD narration strings
- the Home button clears the UE and freezes the local stage until the next selection
- BH cadence and HO phase cadence both reset on UE selection and run independently from that point

### 10.3 Landed Implementation Boundary For Further Visual Slices

The canonical state/presentation split in §10.1 is not only a semantic distinction.
It is also the landed implementation direction for local-view work.

Current repo reality now uses a **single-Viewer seam** inside
`src/features/demo/handover-focus-demo.ts`:

1. `LocalHandoverTruthFrame` builder
   - owns UE anchor truth
   - owns candidate ranking and proxy↔candidate binding
   - owns corridor traverse phase and identity rotation
   - owns HO phase, BH modulation, serving/pending/context role assignment
   - owns handover-count and recent-event truth
2. `LocalHandoverPresentationFrame` or equivalent render input
   - derives visual-only emphasis from truth
   - owns link visibility, cone visibility, label/tag visibility, and role-specific styling
   - must not invent serving/pending/context state absent from truth
3. shell / explainer frame derivation
   - derives text and optional panel-facing state from truth
   - must not back-write semantic state into truth or render layers
4. Cesium renderer
   - owns entities, materials, polylines, labels, and camera-side presentation updates
   - consumes presentation input only

Future local-view slices should stay inside that seam. This repo should **not**
introduce a second Cesium `Viewer`, a second canvas, or a separate local-view
runtime as the default solution for local readability.

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
        ├── compute traverse phase per proxy
        ├── map traverse phase → corridor position
        ├── detect identity rotation (edge recast on non-serving proxies)
        ├── compute HO phase from presentation time
        ├── compute BH modulation from presentation time
        ├── assign roles from ranking
        ├── apply proxies, links, cones (channel separation §7.3)
        ├── increment HO counter on serving id change (§8.3)
        └── sync HUD (if visible)
```

### 11.1 Current Stabilization Seam

The local-focus tick path now follows this conceptual seam:

```
[clock.onTick]
  ├── global constellation.syncEntities(time)
  └── local focus.updateAtTime(time)
        ├── buildLocalHandoverTruthFrame(time)
        ├── deriveLocalHandoverPresentationFrame(truthFrame)
        ├── deriveLocalHandoverShellFrame(truthFrame)
        ├── renderLocalHandoverPresentationFrame(presentationFrame)
        └── syncLocalHandoverShellFrame(shellFrame)
```

Rules for that seam:

- `buildLocalHandoverTruthFrame` is the only place allowed to decide serving /
  pending / context identity, HO phase, BH phase, and handover count truth.
- `derive...PresentationFrame` may compress or simplify visuals, but it must not
  fabricate new semantic states.
- `render...PresentationFrame` is visual-only and may not back-write state into
  the truth layer.

Input events:

- `LEFT_DOUBLE_CLICK` on globe → place a UE anchor at the picked position
- `homeButton.command.beforeExecute` → `clearUeAnchor()`
- `NTPU` preset → `placeUeAnchorAt(NTPU, { transition: "fly" })`

---

## 12. Acceptance Criteria

The demo is successful when **all** of the following hold. Items are visually observable; **none require HUD visibility**.

1. The global layer animates continuously during local focus — it does not pause on UE selection.
2. A double-click anywhere on Earth produces a single UE anchor and a local focus within 1.5 seconds.
3. The three proxy satellites visibly traverse an elevated local sky corridor with predominantly lateral motion, not static wobble in slots.
4. No proxy appears to emerge from the ground, local terrain, or skyline; entry and exit read as sky-edge movement.
5. Under the stable local framing, the cast remains readable as a simultaneous upper-sky band: one proxy near center, one approaching, and one trailing toward exit.
6. Outside `prepared` / `switching`, exactly one UE-coupling cue is resident: the serving solid link / cone / tag.
7. During `prepared` / `switching`, one pending preview cue appears and is visually distinct from the serving cue as a candidate-preparation grammar rather than a second resident service link.
8. The context proxy never draws a UE link, beam cone, or beam tag.
9. Identity rotation is visible over time — a stage lane is re-cast with a different satellite id when alternative candidates are available.
10. A handover event (serving id change) occurs at least once per 8 s cycle and is readable without the HUD.
11. The serving beam cone exhibits a distinct BH cadence (on / off modulation) clearly faster than the HO phase timer.
12. The BH modulation is confined to the serving channel; it does **not** change role labels and does **not** increment the HO counter.
13. Identity rotation and handover events are visually distinguishable without the HUD, via the channel separation in §7.3 (role color / label for HO, opacity / glow for BH).
14. The Home button restores the global layer and clears the UE anchor.

### 12.1 HUD is optional

The HUD is an **optional explainer surface**, not a success gate. If hidden (the default), criteria 1–14 must still be satisfiable by visual observation alone. A demo session that never reveals the HUD is still a valid success.

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

### 14.1 Pre-Realism Architecture Order

Before any realism-track reopen, the current demo line should first finish one
architecture-stabilization pass:

1. extract local handover truth into a dedicated frame builder
2. extract single-Viewer presentation rendering into a dedicated renderer path
3. verify that existing demo semantics in §5–§10 remain unchanged
4. only then resume new readability or cue-expansion slices

This architecture pass is still demo-first work. It does **not** authorize a
second Viewer instance, external local scene runtime, or realism-track scope.

1. replace synthetic candidate ranking with a narrow truth surface (e.g. an ephemeris sampler)
2. replace synthetic global orbit generation with an external orbit source (TLE / SGP4)
3. replace the stage-local corridor with a physically projected local sky-track, while keeping corridor compression as a selectable mode
4. replace presentation-only HO cues with a documented HO FSM
5. replace presentation-only BH strobe with a documented scheduler adapter
6. only then consider multi-UE or external data contracts

Until that realism track is formally opened, this SDD — together with `docs/local-focus-visual-refinement-sdd.md` for presentation polish — remains the authority for the demo's scene semantics and presentation shape.
