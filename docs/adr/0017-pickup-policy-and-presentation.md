# 0017 — Own pickup policy separately from its presentation

Status: Accepted. Date: 2026-11-15.

## Context

The pickup factory received the complete runtime, built map-specific meshes, retained materials,
awarded inventory/health, formatted feedback and decided host/follower lifetime policy. Reset and
replication also need access to the pickup collection, so capturing an initial level or a second
collection would break map replacement and removal.

## Decision

PickupController consumes scoped collection/clock state, local inventory, scene/resources,
transport, live map/spawn readers and a collection-feedback command. It owns ids, spawning,
collection rewards, expiry, host replenishment and retirement. The shared collection remains
explicit for run reset and replication; no runtime or concrete player/transport class enters its
contract. The existing remote/client collection and host expiry authority remain unchanged.

PickupModels owns the ammo/cross/taco geometry and its retained ink palette. Presentation also
formats collection feedback through a small HUD/audio/effects capability. Recipes receive map and
item kind rather than a level or game state. A shared resource-lease port describes retained
palettes for both pickup and remote presentation; it does not expose the concrete resource registry.

## Alternatives and consequences

A typed runtime parameter would retain unrelated dependencies. Duplicating the pickup collection
would require another synchronization/reset protocol. A general item/inventory framework is not
needed for two existing pickup kinds. Explicit live readers and a small controller preserve the
current reset/network API while making geometry reusable independently of policy.

Animation still updates the existing pickup mesh in place. Fixed-step simulation, loot redesign,
prediction/reconciliation and dynamic level generation are separate changes. Runtime/entry and
other legacy controllers remain unchecked JavaScript boundaries under R2/R5.

## Evidence

Before extraction, five composed tests against `d71857d` recorded District/Mexico geometry,
attributes, indices, material uniforms, transforms, animation, resource totals and random calls.
They also cover capped rewards, host/follower collection reports, follower retention, host expiry,
the ten-item replenishment cap and live spawn lookup after map replacement. Transform/animation
numbers use the existing `1e-10` normalization before recording, rather than changing expected
values after extraction. The references pass unchanged, along with weapon/combat traces,
application, multiplayer and repeated resource-retirement checks.
