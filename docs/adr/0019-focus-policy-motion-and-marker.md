# 0019 — Separate focus policy, dash motion and marker projection

Status: Accepted. Date: 2026-11-15.

## Context

The focus factory received the entire runtime. Selection/arming/chain rules shared scratch state
with dash collision/steering and camera-to-viewport projection. Execution reached through the
player's weapon index and frame builder. A short file still coupled unrelated capabilities and
made collision behavior difficult to test independently.

## Decision

FocusController consumes explicit focus state, target/damage queries, player motion/health,
input, feedback and semantic attack/charge/hitstop/marker commands. It owns target ranking,
solo-only entry, arming/release, chain limits and ordered execution/healing. Damage may renew the
chain synchronously through enemy rewards; the controller checks that renewal before shortening
the remaining focus window.

FocusDash owns movement locking, collision step-up, vertical blockage, steering, trail cadence,
timeout and arrival. It receives a dash-state slice, motion pose, collision query and semantic
feedback/completion commands. It has no enemy manager, health/reward rules, camera, HUD or weapon
access. Named vertical collision handling keeps the update path readable within the same owner.
Releasing focus preserves velocity; stopping a dash clears it before a blocked/execution slash.
The katana may then apply its existing airborne lunge. These are deliberately different operations.

FocusMarker owns projection and viewport conversion with one reused vector. It reads current
viewport dimensions without allocating a new viewport object per frame, does not mutate the
target position, and clears targets behind the camera. Focus policy does not access browser globals
or rendering objects. Player exposes `slashKatana()` so consumers request an attack without
reading weapon indices or constructing its internal frame.

Existing focus commands remain available on the returned controller; application/debug composition
wires them explicitly. There is no event bus or runtime lookup. Independent scratch vectors add no
procedural random draws. The original timing, reach, collision steps, healing, feedback and random
order remain unchanged.

## Composition and actor size review

At focus extraction, the scoped wiring raises `application.js` to 320 physical / 315 code lines and its
`createApplication` function to 300 code lines. Retain a temporary composition exception for
explicit construction, capability mapping, development API and disposal; moving those mappings to
helpers bound to runtime would hide the same dependencies. This does not certify its unchecked
JavaScript, callback construction ordering or remaining screen/network/loop coupling. R2/R5 stay
open. New rules/calculations belong in their owners, and adding another controller, lifecycle
responsibility or consumer triggers another review. Checked entry/runtime composition remains the
next structural remedy rather than compressing formatting or suppressing warnings.
The subsequent settings wiring review and current counts are recorded in
[ADR 0020](0020-user-settings-and-preference-port.md).

The four-line player command extends the existing facade exception to 462 physical / 449 code
lines; its constructor remains 109 code lines. The command forwards an existing attack using the
actor's frame and contains no new weapon calculations. This consumer-specific protocol avoids
giving focus a loadout/frame-builder dependency. See [ADR 0010](0010-player-state-ownership.md).

## Alternatives and evidence

A context interface would preserve whole-runtime reach. Separate helper files bound to the old
factory would preserve shared scratch/state and implicit dependencies. An ECS or configurable
ability framework would add machinery without serving another current ability.

Before extraction, eight tests against `3b97396` covered candidate filtering/ranking, chain caps,
release/arming, obstacle step-up/rollback, timeout/dead target, cancellation velocity, blockage,
renewal, damage order and healing. A composed nine-state reference records two actual executions,
camera/player/katana motion, effects, resources, ordered HUD feedback and random draws. It passes
unchanged after extraction. A mistaken initial blocked-slash test expectation was corrected
against the old implementation: the existing airborne lunge is 5.5, not zero. Two marker tests
cover live resizing, input immutability, behind-camera filtering and clearing.

These deterministic checks do not establish real GPU performance or input feel. Runtime/entry,
screen/network/loop binding, adapter options and extracted effects remain open JavaScript work.
