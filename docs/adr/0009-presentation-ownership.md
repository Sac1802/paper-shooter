# 0009 — Separate presentation content from stateful lifetimes

Status: Accepted. Date: 2026-11-14.

## Context

Rendering, audio and effects change for different reasons: a recipe changes a sound or visual;
a scheduler changes timing; a resource owner changes how browser/GPU allocations are retired.
Keeping these responsibilities in one class makes content changes depend on unrelated state.
Extracting methods that still receive the complete original object would retain that coupling.

## Decision

Keep explicit gameplay-facing commands as small facades. Compose independent owners beneath them:

- Ink material construction and shader content live separately from renderer lifetime. A material
  binds the drawing renderer's frame uniforms; renderer instances do not share mutable frame state.
- `SoundSynth` owns the audio context, spatial attenuation and synthesis primitives. Stateless sound
  recipes receive only synthesis commands. `MusicScheduler` owns playback, lookahead and cancellation;
  score data and voice recipes own no timers. `ReelSound` owns the continuous grapple source.
- `ParticleSimulation` owns particle state; `DebrisSimulation` owns fragment state and retirement;
  `Decals` owns surface projection, decal rings and growing marks. `InstancePool` owns reusable GPU
  buffers, and `ParticleRenderer` consumes simulation data. Recipes receive particle/decal capabilities,
  never the complete `Effects` facade.

Preserve the existing update order: particles, growing marks, fragments, instance-buffer writes.
Retain scratch vectors, bounded instance pools and in-place particle compaction. Do not replace
this order with an event bus or allocate a new dependency wrapper for each frame.

## Alternatives and consequences

A generic ECS/audio graph framework would add a new abstraction without a demonstrated requirement.
Splitting files at an exact line boundary would obscure ownership. The explicit owners add modules
and a small amount of facade forwarding, but their collaborators and disposal responsibilities are
visible. Audio contracts are checked TypeScript. Effect instance pools, splat geometry, surface projection
and fragment lifetime now also use checked scene/resource/raycast/particle capabilities. The pool
owns its non-null color attribute and dirty-buffer publication; callers do not assert away the
nullable library field. Particle simulation, recipe sinks, particle rendering and the effects facade
are now also checked TypeScript. Emission, movement/collision and in-place compaction retain their
order, including stepping appended emitter children in the same frame. Rendering reads particle
state and delegates drop/stroke projection within its owner, keeping bounded pools and scratch
vectors. Missing required emitter/stroke vectors produce explicit invariant errors at the same
use sites that previously failed implicitly; valid states and random draw order are unchanged.
The canonical spawn normalizer keeps its eighteen nullish defaults together: its complexity warning
comes from the option schema and remains visible, rather than creating artificial helper stages. The retained seven-argument
buffer write stays explicit to avoid allocating per-instance parameter objects; its positional
parameter warning remains visible for review. Existing composed fingerprints and fragment-cap/expiry
resource regressions pass unchanged.

## Evidence

Audio regressions compare the complete recorded Web Audio graph and envelope schedules for game
sounds and both full themes against fingerprints captured before extraction. Effects regressions
compare pooled instance matrices/colors through collisions, growth and expiry, also against a
pre-extraction fingerprint. Resource tests observe actual Three.js disposal events. Map and movement
baselines remain unchanged. These deterministic checks do not replace listening, visual acceptance
or real-GPU performance measurements.
