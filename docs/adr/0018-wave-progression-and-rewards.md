# 0018 — Separate solo progression, rewards and event binding

Status: Accepted. Date: 2026-11-15.

## Context

The wave factory received the complete runtime and registered enemy death/boss observers and
grenade transport callbacks. It combined queue/intermission/checkpoint progression, map-dependent
spawn selection and kill/combo/focus/loot policy. That made changes to a solo wave depend on
weapon internals and network reporting unrelated to progression.

## Decision

WaveController receives explicit wave state, current-level/checkpoint readers, progression
persistence, local supplies, enemy spawning, collision queries and feedback. It owns the existing
queue, intermission, supplies, checkpoint and boss-scaling rules. Ground, flying and boss spawn
algorithms have named private methods with their own inputs; they remain one cohesive controller,
without another manager or a helper module bound to runtime.

EnemyRewards consumes only kill/combo/streak state, grounded status, blade feedback, focus entry,
score/audio and loot commands. The base reward calculation is a pure domain function; the owner
preserves counter, blood/focus, airborne bonus, score, sound and random-loot order. Death lifecycle
still decides whether an enemy is notified exactly once. Combo multiplication remains with the
score owner rather than being applied twice.

The composition root registers enemy observers and grenade reporting explicitly. WaveController
has no transport or weapon-index access and does not install event handlers. Live level readers
avoid retaining obsolete map data. Checkpoint persistence is supplied through a command rather
than exposing the preference adapter to wave policy.

## Alternatives and consequences

A typed whole-runtime parameter or a wrapper passing the same runtime into several helper files
would preserve semantic coupling. A generalized wave DSL, item framework or strategy hierarchy is
unnecessary for the current rules. Typed owners and private spawn algorithms describe existing
responsibilities without changing their balance or introducing an event bus.

The existing boss fallback remains bounded to 200 attempts and retains its original coordinates,
distances and collision checks. Making those bounds configurable/map-aware is a separate gameplay
decision, not hidden inside this extraction. Entry/runtime composition, focus, screens, multiplayer
binding and the loop still have unchecked JavaScript boundaries under R2/R5.

## Evidence

Three composed characterization tests passed before extraction at `4691ee1`. They cover initial
supplies, queue/modifiers, checkpoint progression, later boss HP scaling, intermission/healing,
hidden/distant/sniper spawns, flying bounds and all bounded boss fallback paths. Reward cases cover
critical, severed/nonsevered melee, focus, deflection, falling, blast streak retention, airborne
bonuses, focus charging and loot thresholds. They pass after extraction alongside the historical
ten-archetype enemy trace and composed application, weapon, combat and multiplayer regressions.
Procedural fixtures and map content were not regenerated or edited to accept the extraction.
