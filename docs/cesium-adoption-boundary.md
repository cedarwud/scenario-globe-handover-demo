# Cesium Adoption Boundary

This file records the Cesium boundary that still applies to the current demo repo.

## Boundary Statement

This repo adopts Cesium as an upstream runtime and configuration surface. It does not reimplement Cesium subsystems.

## Allowed

- install Cesium through `package.json`
- copy runtime assets into the delivery build
- configure `Viewer`, imagery, terrain, tilesets, credits, and performance settings
- add thin wrappers around Cesium bootstrap and provider factories
- add repo-local contracts that keep external data plain and serializable

## Not Allowed

- forking Cesium
- copying Cesium source into this repo as a maintained code path
- editing Cesium renderer, shader, terrain, worker, or 3D tiles internals here
- treating archived viewer lines as implementation authority
- turning the walker fixture into a core schema assumption
- treating narrative proxy-satellite staging as a reason to fork Cesium rendering internals

## Subsystem Boundaries

| Subsystem | Repo policy |
|---|---|
| renderer and shaders | leave upstream-owned |
| worker runtime | solve with asset copy and deployment paths, not source patches |
| terrain and imagery providers | configure providers, do not clone provider internals |
| 3D tiles pipeline | configure and wrap, do not reproduce |
| Cesium app shells and example shells | use for reference only, do not transplant wholesale |
| credit handling | wrap lightly, never remove attribution |
| `Viewer` versus `CesiumWidget` | choose one wrapper path and document the choice in ADRs |

## Demo Implications

- The demo repo owns bootstrap, toolbar additions, local-focus contracts, and presentation.
- Cesium owns rendering internals, worker internals, and packaged runtime assets.
- Choosing local or on-prem providers is a deployment configuration decision, not a reason to pre-disable native `Viewer` capabilities.
- Repo-local evidence for this boundary lives in [cesium-evidence.md](./cesium-evidence.md).
- Any change that crosses this boundary needs a new ADR before code moves.
