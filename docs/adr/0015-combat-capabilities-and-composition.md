# 0015 — Compose combat policies through scoped capabilities

Status: Accepted. Date: 2026-11-15.

## Context

The application combat factory installed target queries, damage, rope/prop operations and shot
reporting onto a shared mutable `ctx`. Weapons and actors had already gained checked ports, but
composition still read those dynamically registered functions. Combat policy also mixed spatial
queries, health/authority, prop resource transfer, packet formatting and feedback.

## Decision

- PlayerQueries owns player body/guard ray selection and melee visibility queries. It receives
  target/eligibility readers and visibility, with independent scratch vectors and no damage or
  transport access. Every guard competes in the same nearest-hit comparison as every other player.
- PvpDamage owns guard/return/parry and player-hit decisions. It consumes local hit-receipt/damage,
  opponent pose, feedback, hitstop and melee-postponement commands. It emits semantic damage/guard
  reports. Application composition owns wire rounding, sender metadata and packet formatting.
- RopeCuts owns the existing fifteen-sample rope cut window and emits peer identity plus a borrowed
  hit point. It never sends packets or accesses an actor/runtime. Sampling resolution/range stays
  unchanged.
- GrenadeBlast owns ordered thrower/local authority and damage. Presentation runs before enemy and
  prop damage, then local damage/impulse and eligible remote reports. Foreign blasts do not apply
  thrower-owned enemy/prop/remote damage. Local and remote falloff remain distinct.
- PropCombat owns prop health, arc/blast selection, quiet retirement and loot/score/report policy.
  Current-handle lookup is injected by the level owner; a same-id object is insufficient to mutate
  a different live prop. Lookup does not retain obsolete level collections. The current map adapter
  uses its existing dense prop ids; a future dynamic map can provide another lookup implementation.
- PropFeedback owns fragment transfer and prop-specific effects/sound behind visual/resource ports.
  It receives no health, collider or reward state. Transfer/release precedes loot; completion sound
  follows loot and precedes replication, retaining the old random-draw and callback order.
- Checked application combat composition receives consumer-defined capabilities and returns a fixed
  command/query API. It registers no functions on a mutable game context. Participant collection,
  live level/navigation readers and concrete provider wiring belong to runtime composition.

The local actor's weapons need combat queries while combat needs the actor. Keep that construction
cycle in the composition root using lazy readers and a service reference assigned once. Constructors
must not fire attacks; user input/loop scheduling starts only after composition completes. Pickup
commands also resolve after their owner is constructed. The integration baselines exercise this
ordering. There is no global service lookup or runtime object passed into policy leaves.

## Alternatives and consequences

A context interface or another action bag would preserve dynamic registration and whole-runtime
access. An event bus would additionally hide the synchronous effect/damage/report order. The
explicit owners add a small composition API but expose dependencies and authority to the checker.
Level/NPC data and wire representations retain their existing formats; map content and balance are
unchanged. Runtime construction and several other application/presentation controllers remain
JavaScript boundaries under R2/R5, so this decision does not certify the entire codebase as checked.

## Evidence

Before extraction, a composed reference against `70baa77` recorded ten combat states: eligible hits,
blade deflection/returns, slash parry, rope cutting, prop kinds/quiet removal/solo reward, owned and
foreign blasts, shot reports, feedback, resource counts and random calls. It remains unchanged.
A separate integration regression first reproduced a farther player's guard replacing a nearer
player hit. The fix in `526d65a` precedes query extraction and verifies both join/iteration orders.
Isolated tests cover permission/death filtering, query ordering/visibility, rope reach, blast
ownership, current prop handles, collection replacement, loot authority and ordered PvP outcomes.
All existing map, player, weapon, enemy, remote and multiplayer baselines remain in force. These
checks do not establish real-network latency or device/GPU performance.
