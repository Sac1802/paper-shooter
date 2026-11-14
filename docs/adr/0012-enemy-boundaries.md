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
- Archetype definitions use a checked discriminated union: burst guns, shotgun, sniper, blade,
  bomber, flyer and bosses declare the fields their behavior requires. Numeric balance values
  remain unchanged. RangedAttack owns burst and sniper aim progress, with explicit muzzle,
  cooldown, numeric target speed, projectile emit, damage modifier, laser and feedback ports.
  It receives neither actor nor manager and does not schedule asynchronous work.
- EnemyAreaDamage owns enemy blast falloff and bomber player/enemy area policy through target
  readers and damage/feedback commands. EnemyLifecycle owns ordered death, explosion retirement
  and per-operation notification suppression. EnemyDeathFeedback owns shared death/explosion and
  flying-fragment transfer recipes. Feedback emits the transfer event before debris registration;
  resources remain with the fragment owner. A reproduced nested-observer case established that
  suppressing one mirrored death must not globally suppress a different death notification.
- EnemySimulation owns host frame phases, gravity/world integration, target separation and
  pair-separation cadence behind actor/world protocols. It retains live-array iteration so summons
  are processed in the same frame. Spawn finalization follows hit-region synchronization; target
  separation follows root pose writes, matching the old order. Replicas do not execute host AI
  or collision integration.
- EnemyReplication owns compact snapshot projection, previous/next history, interpolation and
  history clearing. It consumes an actor replica protocol with state/health/pose commands and
  knows no concrete model or brain. The eleven-number tuple, 100 ms render delay, bounded
  extrapolation and inferred velocity clamp retain the original behavior. A replica trace was
  recorded against manager/projectiles from `1e168d2` before applying the extraction; it also
  passes against the current code. No new enemy transport message or co-op mode is introduced.
- EnemyActor provides the checked actor-facing surface; construction recipes connect components
  through environment, feedback and policy capabilities. The recipes receive construction data
  and lifecycle commands, not the manager or application runtime. Leaf owners receive their
  individual ports. Identity-only callbacks resolve against current population membership before
  lifecycle/client-hit/boss commands. Actor animation/hit-region projection uses checked model
  markers and a reusable frame.
- EnemyCombat owns HP/max HP/shield state and authority decisions. Mirrors report hits without
  applying host-owned damage; population membership owns the death transition. EnemyHitFeedback
  owns flash/flinch and the blood/audio/HUD/rumble recipes behind outcome ports. Fuse flashes
  remain independent of damage flinch. A stale cleared actor is rejected before health or
  feedback changes. Boss updates retain their ordering before death requests.
- Enemy model construction returns a checked discriminated walking/flying rig, with named
  joints and mutable hit-region projections. EnemyDisassembly owns walking-model fragment
  selection/transfer, shield detachment and corpse pose. It receives model/pose and feedback
  capabilities, never health or the actor/manager. A deterministic domain classification preserves
  the existing overkill/reward thresholds; shield score changes remain outside presentation.
- EnemyPopulation owns membership, ID allocation shared with projectiles, live counts and
  reverse-order corpse retirement. Read-only collection/index surfaces replace coordinator writes.
  Match clear preserves the allocator. Death is idempotent and requires current membership; stale
  references cannot decrement a cleared population. The repeated-death/reward defect was reproduced
  and fixed separately before extraction. Scene retirement is an injected, reused command; the
  registry has no renderer or combat dependency.
- DoodlerBehavior, EraserBehavior and InkblotBehavior each own their attack variants, phase
  timers/counters and aiming. They consume body/motion, shared cooldown and narrow target,
  projectile, summon and feedback commands. BossFeedback owns stomp/charge/summon/landing
  recipes and reusable endpoints. The compact network attack bit retains its existing approximate
  active-phase recovery: stomp for Doodler, scrub for Eraser and summon for Inkblot. A charge
  direction must be captured during the bounded frame loop's windup.
- FlyerBehavior owns orbit/dive/climb/stun mode, bounded aerial acceleration, dive hit windows
  and geometry avoidance. It consumes body, cooldown, numeric modifiers, target combat, orientation
  and feedback ports. It emits actor stun/recovery commands without owning population life/death.
  The legacy transition order is retained, including a parried dive exiting into climb.
- RangedBehavior owns gun-enemy aim, range/height routing, spacing and strafe cadence. It
  consumes body/motion, attack commands and numeric target motion/age. Mirrored aim and idle
  damping do not drive attacks. A typed seed factory keeps all nine original initialization
  draws in order, including draws unused by individual archetypes, so extraction does not
  perturb subsequent procedural geometry or AI variation.
- BladeBehavior owns preparation, single-hit and retreat windows behind motion, cooldown, target
  combat and feedback ports. EnemySlash owns the reusable five-stroke visual telegraph endpoints.
  The pre-existing zero-distance melee division was reproduced and fixed in `741ba7a` before
  extraction; composed regressions retain finite motion through lunge, standoff and parry overlap.
- EnemyPerception owns visibility-query cadence and a borrowed target frame with distances,
  height and heading. Eye reads and visibility are narrow capabilities. BomberBehavior owns fuse
  state and pursuit/arming decisions; it emits flash, fuse and explosion commands while population
  combat policy retains damage/death authority. Desired headings belong to the body navigation
  component, so behaviors do not write the legacy actor record.
- EnemyNavigation owns one body's route, refresh deadline, waypoint progress, formation offset and
  obstacle recovery. It consumes world rays, a live navigation-grid reader and the speed modifier;
  it returns optional headings instead of mutating an enemy record. Body creation is moved before
  its coordinator record without moving any random draw. Formation seeding retains its original
  position in the random sequence.
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

This decision is incremental: the legacy manager capability binding and client-frame coordination still remain in
the legacy JavaScript coordinator. Checked queries/projectiles/model recipes do not imply that the
manager or its composition is checked. R3 and R5 remain open until those responsibilities have their
own contracts and owners.

## Evidence

Before extraction, ten archetype traces captured geometry bytes, animation/state outcomes,
projectiles, death/resource retirement and random call counts through composed application play.
All remain unchanged. Isolated tests cover visibility, retarget deadlines, hit-region precedence,
ignored targets, boss melee reach, burst/cooldown timing, interrupted aim/fire, progressive sniper tracking, shotgun pellet bounds,
bounded steering, route reuse/retry, grid replacement, grounded
obstacle recovery, world collision priority, remote damage ownership, wider guard
catches, reflected hits, blast authority, shared/replicated IDs, capacity and expiry. Presentation regressions verify independent gait state, immutable borrowed
frames, bounded corpse interpolation and idempotent telegraph resource retirement. These checks
supplement the composed application/multiplayer regressions; they do not replace real-device
visual/performance acceptance.
