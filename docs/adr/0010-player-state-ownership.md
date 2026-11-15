# 0010 — Own player state in independent components

Status: Accepted. Date: 2026-11-14.

## Context

A player combines several update phases, but their state has different lifetimes and invariants.
Extracting methods into helpers receiving the whole player would preserve the original coupling.
Locomotion also shares a physics body with the grapple, so replacing it with disconnected copies
would change rope constraints, jump timing and collision behavior.

## Decision

Keep one explicit phase coordinator and compose checked components with owned state:

| Owner             | Responsibility                                              | Collaborators                                                       |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `Locomotion`      | Posture, sprint/slide/dash/mantle, body integration         | Input, world/spawn, grapple commands, motion feedback               |
| `Jumps`           | Jump buffer, ground grace, wall contact and extra air jump  | Physics body, movement frame, grapple detach command                |
| `Grapple`         | Hook transitions, rope constraints, stamina and recovery    | Physics body/pose, geometry/target queries, view, feedback          |
| `Grenades`        | Inventory, charge, throw packets and projectile lifetime    | Pose, ray queries, visual adapter, feedback, blast outcome callback |
| `Equipment`       | Weapon selection, temporary melee return and input dispatch | Weapon commands, input, pose frame, selected/sights feedback        |
| `PlayerCombat`    | HP/recovery, death and guard windows                        | Physics body/pose, current guard state, outcome feedback            |
| `FirstPersonView` | Look pose, stride, recoil/landing springs and projection    | Camera/body, shake sample, footstep command                         |

Planar acceleration is a deterministic domain calculation operating only on velocity and a numeric
frame. Grenade blast damage is an application combat policy; projectile simulation reports the
blast position and local ownership without traversing the game runtime.

The body and pose vectors are shared explicitly as physics/read-model data. Components receive no
complete player, arbitrary runtime lookup, mutable controller action bag or callback that exposes
their former owner's state. Feedback adapters translate specific outcomes into existing commands.
They own no gameplay state and do not call movement/weapon transitions in return.

Preserve the order of look, movement input, acceleration, jumping, body/grapple integration,
recovery/view update, grenade input/projectiles and weapon input. Keep preallocated frame records
and scratch vectors in hot paths. Preserve the original random-draw order.

## Alternatives and consequences

An ECS would add a broad framework without a demonstrated query/composition requirement. Inheritance,
prototype patches and method chunks bound to `Player` would obscure state ownership. Explicit
components introduce contracts and forwarding code, but can be exercised without DOM, audio,
networking or full application setup.

Player now also has a checked actor/service surface. Its capabilities are grouped as environment,
input, presentation, weapons, grapple queries and a death command; it receives no application
runtime or manager. Equipment preserves its concrete loadout type through a generic parameter,
while leaf components consume only their own protocols. Guard feedback explicitly models the
absence of a blade response. Application runtime construction and controller adapters remain
JavaScript boundaries under R5; checking the actor does not certify those callers.

## Coordinator size exception

The current checked `player.ts` has 458 physical / 445 code lines; its constructor has 109 code
lines. Type declarations make the public actor/component surfaces explicit. The file remains over
the advisory size threshold and has no cyclomatic-complexity findings. The exception covers
composition, phase order and forwarding to independent state owners, rather than movement,
weapon, grapple or health calculations. The earlier JavaScript checkpoint had 434 physical /
421 code lines and a 118-line constructor.

Retain explicit forwarding instead of mixins or separate getter files: distributing those members
would obscure the actor protocol without creating another state owner. Leaf components receive
scoped capabilities and reusable frames, never this facade. New gameplay calculations must go in
the corresponding owner. Reassess this exception when adding another actor consumer, command or
state owner; prefer a consumer-specific protocol to expanding access to the entire facade. Keep
the generated warnings visible. This exception does not waive R5 composition or other open review
findings, and is not a universal recommendation for 445-line modules.

## Evidence

Pre-extraction movement, grapple, grenade and camera traces remain unchanged. They cover hook flight,
attachment/reeling/jump release; charged/remote throws, bounce, blast damage and reset; camera
projection, recoil, guard flash, damage and death. Component tests additionally cover obstruction,
fall/mantle/focus boundaries, targeting precedence/occlusion, target death, stamina, loadout return
cancellation, recovery timing and guard cones/cooldown. Preserve these baselines when changing source
layout; do not regenerate them to accept unexplained behavior changes.
