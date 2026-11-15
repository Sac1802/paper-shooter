# Construction and boundary checkpoint

Date: 2026-11-15. This is an implementation checkpoint by the implementing agent, **not** the
independent final review. That review remains deferred until the user's explicit confirmation.

## Original findings

Controller/runtime boundaries (R2) and concrete option types/unchecked assembly (R5) are implemented
in [ADR 0027](../adr/0027-checked-construction-and-adapter-capabilities.md). Application and runtime
construction are strict TypeScript; controllers receive consumer protocols rather than runtime.
Session owns phases and delayed prompts; connection tasks own cancellation; host recovery captures
identity before retiring endpoints. Explicit lazy commands are connected before animation starts.

The checked reusable map kit and world/level contracts also support future authoring without
registry dependency cycles; see [ADR 0028](../adr/0028-checked-map-kit-and-stable-recipes.md).
The two recipe bodies and recorded map output remain unchanged.

The remaining original findings have implementation evidence in the historical
[review](2026-11-14-refactor.md): validated payloads (R1), actor/weapon/enemy owners (R3), scene resources
(R4), query/discovery lifetime (R6), presentation ownership (R7), and complete static import checks
(R8). Their passing checks support those changes, not a claim that every possible defect is fixed.

## Size review

The 300-code-line signal stays advisory. These scopes retain their visible warnings; none is a
blanket allowance for growth. Counts exclude blank/comment-only lines and come from the current
structure report, not from physical file length.

| Scope                              | Code lines | Reason for retention in this refactor                                                                                                                                                               | Next review trigger                                                                                |
| ---------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| District / Mexico recipes          |  560 / 600 | Each describes one map's geometry, props, colliders and arena variant through the reusable kit. Preserve the user's existing maps and recorded random draws.                                        | New map content or a reusable section shared by another map.                                       |
| Player facade                      |        449 | Checked coordinator/read model over independent locomotion, grapple, inventory, health, camera and weapon owners; no runtime parameter. ADRs 0010/0019.                                             | New ability or consumer that requires exposing more component internals.                           |
| Committed PeerJS transport         |        407 | Established role/connection/alias lifetime; discovery/query are already separate. Public composition contracts and runtime decoding are checked, while this body remains JavaScript migration debt. | New routing, retry, role or transport behavior; review the committed endpoint owner before growth. |
| Collision world                    |        382 | Coherent spatial hash, body sweep and ray queries with shared scratch storage, separate from actors and maps. Existing movement/map/collision traces remain authoritative.                          | A new collision primitive or query consumer that needs exposing grid internals.                    |
| Application / runtime construction |  374 / 305 | Explicit state/adapter construction, scoped command wiring, diagnostics and teardown; strict assembly checking now covers the real defaults. ADR 0027.                                              | New business policy, controller or lifetime responsibility.                                        |
| Browser input                      |        305 | One adapter arbitrates keyboard/mouse/gamepad into a normalized frame and owns pointer-lock/listener lifetime. Its public consumer surface is isolated; the body remains JavaScript debt.           | New device or input policy; separate polling/arbitration before adding independent state.          |
| Remote facade                      |        302 | Checked target/read model over interpolation, rope, animation and death owners, with scene/material retirement. ADR 0014.                                                                           | New remote behavior beyond projection or another model backend.                                    |
| HUD adapter                        |        301 | DOM template, display caches and presentation commands; session/menu/score policy lives elsewhere. Its body remains JavaScript debt.                                                                | A new independently stateful widget or UI lifetime requirement.                                    |

## Complexity review and limits

Death feed text, ragdoll metadata and periodic match-clock reporting are separated into their
respective policy/presentation steps. Fragment blood-trail emission has its own private step;
particle emission, motion, collision, compaction and drop/stroke projection retain ordering and
reuse existing vectors/buffers. Their composed references were not regenerated.

Remaining high-path-count code includes map recipes, navigation construction/nearest-node search,
input arbitration, host creation, raycasting, query teardown, musical phrase cases, grenade-arc
prediction and canonical schemas/bit packing. These warnings remain visible migration/review debt.
Canonical particle defaults (18 nullish choices), score validation and snapshot flag order stay
together rather than creating one helper per field. Review the corresponding behavior before
changing it; a green quality gate does not automatically approve each structural warning.

Procedural map recipes, navigation, browser input/HUD/renderer, committed transport, the sound
forwarding facade and shader/re-export content still have JavaScript bodies. Construction and their
consumed contracts are checked; those bodies are not silently described as fully statically checked.
All remain in import analysis, tests and whole-product coverage. Future migration is supported by
the new boundaries and must preserve the same references.

Real graphics/audio/controller feel and cross-network STUN/TURN acceptance remain manual release
checks. Local software-rendered traces and in-memory peers do not establish GPU performance or NAT
reachability. No deployment or map redesign is part of this checkpoint.
