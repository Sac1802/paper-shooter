# 0011 — Separate weapon mechanics, impact rules and presentation

Status: Accepted. Date: 2026-11-14.

## Context

A working weapon couples several kinds of change: its numeric rules, projectile/hitscan results,
its procedural model and its visual cycle. The previous gun update mixed all of them in a method
with cyclomatic complexity 49. Merely putting that class in another directory would keep the same
state ownership and make reuse difficult.

## Decision

Use independent, checked owners behind small gameplay adapters:

- `GunMechanics` owns ammunition, cooldown, reload/pump timing and dispersion. `MeleeMechanics`
  owns attack/combo timing, hit windows and guard state. Neither owner knows a scene, actor, DOM,
  audio context or transport. Versioned gun definitions have an explicit data contract.
- `GunAnimation` owns flash, pump/rack milestones and the model's reload pose. `BladeAnimation`
  owns guard pose, parry motion and the blade's blood appearance. These consume numeric phase
  frames and model/spring/cue ports; they receive no complete gun or katana.
- Model recipes and a reusable geometry kit produce named attachments. They do not construct
  gameplay state or schedule work. Their caller owns the scene resources under ADR 0008.
- `ShellEjection` consumes an eject point, pose and emit command. It owns scratch vectors and
  does not query the player/controller beyond that pose contract.
- Nearest-ray precedence and critical/distance damage are deterministic domain rules. The
  Hitscan owns enemy/player/world selection, distinct PvP damage, prop precedence and tracer
  outcomes through checked query/damage/feedback ports. Its muzzle reader runs after damage
  callbacks, retaining original order; callers reuse that reader rather than allocating it per pellet.
  MeleeImpacts owns ordered enemy/player/rope/prop interaction and borrowed-input protection.
  Neither policy receives the weapon, its view or application runtime; composition binds live
  multiplayer/prop commands. The gameplay adapter retains weapon feedback and presentation.

Keep the existing transform, timer and feedback order. Borrow preallocated pump/swing frames during
synchronous updates instead of allocating per-frame dependency wrappers. Automatic magazine reload
has one owned timer, cancelled through loadout/player/application disposal.

## Alternatives and consequences

A generic animation graph or an ECS would add an infrastructure dependency for a handful of fixed
cycles. Method mixins bound to the original weapon would leave hidden access to its full state.
Explicit model/phase contracts add some forwarding, but let mechanics tests run without rendering,
audio, enemies or application setup.

Gun and Katana are now checked adapters with explicit player-pose/action, impact, audio, input,
effects and hitstop services. Their common ViewModel base owns only view motion and consumes a
typed frame; it has no application context. Gun balance metadata stays in its definition rather
than being copied onto the instance with Object.assign. A reused muzzle reader avoids a new
callback allocation for each pellet. The legacy player/runtime binding is still migration work
for R5; these checked adapters do not imply that composition is checked. Do not pass a complete
adapter into a leaf owner or add unrelated state to a phase frame.

## Evidence

Fingerprints captured before extraction record all five weapon geometries, material palette/fill
values and action-cycle transforms through firing, complete reloads, guard, parries and blade
blood. They remain unchanged. Additional tests cover ammo conservation, reload interruption,
trigger/cooldown/pump gates, single-hit melee windows, combo/guard timing, hit-distance ties and
falloff bounds. Isolated impact tests cover PvP/fallback critical damage, wall/prop ties and
ricochet draws, muzzle/tracer order, bounded miss endpoints and ordered melee vector ownership.
Timer regressions verify automatic reload both runs when intended and cannot run
after application disposal. Real-hardware visual/performance acceptance is still a separate check.
