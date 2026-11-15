# 0024 — Separate incoming combat policy from network feedback

Status: Accepted. Date: 2026-11-15.

## Context

The multiplayer binder applied received damage and kill credit alongside tracer geometry, parry
particles, rumble, audio and rope feedback. It captured the whole runtime and shared scratch vectors
across applications. A transport callback knew both actor mutation rules and presentation recipes.

## Decision

CombatMessages applies already decoded damage/death/grenade/parry/rope reports through consumed
actor, role, score and feedback capabilities. It records attribution before invoking damage, retains
alive/play/spawn-protection guards, and preserves local kill-credit versus host tally authority.
It requests visual/audio feedback and does not construct tracers, inspect HUD elements or decode
untrusted wire payloads. Phase transitions remain owned by session/actor health commands.

NetworkCombatFeedback owns muzzle/tracer projection and parry/rope presentation. It reads actor
vectors, forwards HUD/audio/rumble commands, and cannot apply damage, edit scores, change phases or
send messages. Scratch muzzle/endpoint vectors belong to each presentation instance and are reused
per shot, retaining the original widths, offsets, lifetime and presentation order. Actor vectors
remain unmodified.

The multiplayer binder registers typed-owner callbacks after transport decoding and host checks.
Remaining roster/supply/score binding and unchecked root/runtime composition remain open; these
changes do not close the entire R2/R5 review or claim the JavaScript composition is typechecked.

## Alternatives and consequences

A shared runtime-typed message manager would preserve unrelated authority. Moving callbacks into
files while binding them to the same runtime would only change their location. Scoped policy and
feedback ports support Node tests without a renderer, map, browser or signaling connection.
No packet format, scoring rule, effect recipe, map content or balance changes are introduced.

## Evidence

Three application-level tests recorded before extraction preserve damage guards and attribution
ordering, remote ragdoll/audio/local credit/host tally order, follower feed-only scoring, and
shot origins/widths/endpoints/presentation with dead/retired/missing actor guards. Their assertions
remain unchanged after extraction. Node tests exercise actor commands and parry/cut projection,
including vector immutability. Existing composed two-/three-client tests and map/gameplay references
remain in force. Automated traces do not establish real GPU/audio/NAT acceptance or performance.

Subsequent [ADR 0027](0027-checked-construction-and-adapter-capabilities.md) implements the entry/runtime
construction and structural adapter-option work left open at this checkpoint.
