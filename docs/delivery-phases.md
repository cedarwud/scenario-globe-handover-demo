# Current Status And Historical Phase Notes

This file is retained because the repo grew out of an earlier Cesium build-up plan, but it is
no longer the active implementation roadmap.

For current intent, prefer:

1. `README.md`
2. `docs/local-handover-focus-demo-sdd.md`
3. `docs/local-focus-visual-refinement-sdd.md`
4. `docs/architecture.md`

Use this file for two things only:

- understanding which old Cesium foundation work is still present
- avoiding accidental reactivation of the old `Phase 0 / 1 / 2.7 / ...` planning language

## 1. Current Repo State

The repo currently has four stable buckets of work:

### 1.1 Retained Cesium Foundation

Still active and used by the demo:

- `CESIUM_BASE_URL` bootstrap
- native `Viewer` shell
- native toolbar and home button
- imagery / terrain default-selection policy
- home-camera tuning
- lighting, atmosphere, star background, and related baseline scene controls
- build verification and browser bootstrap smoke

### 1.2 Active Demo Surfaces

These are now the main repo identity:

- synthetic global constellation
- same-page local handover focus
- double-click site selection
- NTPU preset shortcut
- sky-mode toggle
- optional OSM Buildings context layer

### 1.3 Deferred Realism Work

Explicitly not landed yet:

- real orbit ingestion
- real handover logic
- real site datasets
- realistic RF or KPI semantics

### 1.4 Known Visual Limit

The repo has already validated that same-page dual-scale interaction works.
What remains unresolved is mostly **scene quality**, especially the gap between raw Cesium + OSM
context and the more curated local scene quality seen in `ntn-sim-core`.

## 2. Historical Mapping

The old Cesium phase language should now be read only as bootstrap provenance:

| Historical phase idea | What remains relevant now |
|---|---|
| `Phase 0` | package pin, asset copy, bootstrap evidence, repo-owned docs |
| `Phase 1` | first native `Viewer` shell and browser smoke |
| `Phase 2.x` | globe baseline, home-camera tuning, imagery/terrain policy, lighting, atmosphere, OSM context |
| `Phase 3+` | no longer the active repo roadmap |

Important clarification:

- this repo is **not** currently "in Phase 2.7"
- `Phase 2.7` only survives as historical shorthand for one earlier camera-tuning slice
- current work should be described as **demo-first same-page handover validation**

## 3. Current Verification Surface

The repo still keeps two verification commands:

- `npm test`
  - build verification bundle
  - legacy script name, no longer read as `Phase 0`
- `npm run test:phase1`
  - browser bootstrap smoke
  - legacy script name, no longer read as the active project phase

These names remain for compatibility, but the project should now talk about:

- build verification
- browser bootstrap smoke

instead of:

- `Phase 0`
- `Phase 1`

## 4. What Should Not Be Reintroduced

Do not reframe the repo back into the earlier Cesium plan unless there is an explicit request.

That means:

- do not describe the repo as a generic Cesium delivery repo
- do not talk about the current branch as `Phase 2.7`
- do not make future work depend on reviving an old phase ladder
- do not let bootstrap provenance docs override the demo SDDs

## 5. Practical Follow-On Directions

If this repo reopens for more work later, the likely next tracks are:

1. visual polish of the local focus presentation
2. semi-real data integration on top of the current demo seams
3. explicit decision to stop here and treat the repo as a validated prototype checkpoint

Those are the current follow-on choices. The old phase ladder is no longer the governing plan.
