# 0012 — Separate enemy queries, projectile simulation and character presentation

Status: Accepted. Date: 2026-11-14.

## Context

EnemyManager combines population ownership, spatial queries, health/death policy, steering,
archetype behavior, replication and animation. Projectiles previously received that entire manager,
which also exposed the full application context. Moving methods into helpers bound to the manager
would retain those dependencies.

## Decision

- Character model recipes consume visual definitions and return named joints/hit regions. Humanoid,
  bomber/blob and flyer construction share a small geometry kit, faces, hats and weapon props.
  They remain reusable by enemies, remote players and map decorations. Their caller owns scene
  resources under ADR 0008; geometry construction does not own gameplay or timers.
- WalkerAnimation and FlyerAnimation own gait/phase and joint poses. They consume one reusable
  numeric animation frame per actor, with no actor, manager, scene or application access. EnemyLaser
  owns the lazy sniper telegraph and its disposal; DeathPose owns bounded topple interpolation and
  corpse fade. Gameplay still owns death authority and retirement deadlines.
- EnemyQueries consumes population/target readers and visibility. It owns scratch vectors and
  implements nearest-target selection, cached retargeting, hit-sphere rays and melee arcs without
  damage, audio, rendering or transport access. Retarget state belongs to the queried actor.
- Projectiles owns lifetime, capacity, motion, collision order and deflection policy. Its checked
  ports expose only world rays, target reads, enemy queries, damage/blast commands, feedback,
  authoritative-mode reads and the shared ID allocator. It receives neither manager nor runtime.
- ProjectileView owns instance buffers and reusable transform scratch values. Simulation supplies
  a borrowed render list; the application scene registry owns GPU resource disposal. Clearing a
  match clears instances while preserving this application-lifetime renderer.

Use a named shot definition instead of nine positional fire arguments. Keep enemy/projectile ID
interleaving, random draw order and feedback order. A world hit consumes a projectile before actor
checks. Each peer handles its local player's damage; a remote hit consumes the local visual copy
without applying remote damage. Enemy blast damage is applied only by the authority. A reflected
projectile becomes eligible for enemy impact on the following update.

## Alternatives and consequences

A generic ECS, event bus or engine-wide query registry adds machinery without reducing the required
ownership decisions. Narrow structural ports add explicit composition while allowing isolated
collision/authority tests. Existing EnemyManager forwarding methods preserve actor/weapon callers
until the remaining orchestration migration.

This decision is incremental: enemy AI, lifecycle and replication still remain in
the legacy JavaScript coordinator. Checked queries/projectiles/model recipes do not imply that the
manager or its composition is checked. R3 and R5 remain open until those responsibilities have their
own contracts and owners.

## Evidence

Before extraction, ten archetype traces captured geometry bytes, animation/state outcomes,
projectiles, death/resource retirement and random call counts through composed application play.
All remain unchanged. Isolated tests cover visibility, retarget deadlines, hit-region precedence,
ignored targets, boss melee reach, world collision priority, remote damage ownership, wider guard
catches, reflected hits, blast authority, shared/replicated IDs, capacity and expiry. Presentation regressions verify independent gait state, immutable borrowed
frames, bounded corpse interpolation and idempotent telegraph resource retirement. These checks
supplement the composed application/multiplayer regressions; they do not replace real-device
visual/performance acceptance.
