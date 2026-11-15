# 0027 — Check application construction and injectable adapter capabilities

Status: Accepted. Date: 2026-11-15. Completes the construction work left open in ADRs 0019–0026.

## Context

Checked controllers still received their dependencies from unchecked entry/runtime bodies. Options
named the concrete Input, HUD, Sfx and Net classes, including internals that a replacement adapter
should not need. Typechecking individual owners could therefore miss mistakes in their assembly.

## Decision

- Application options accept structural input/HUD/audio/transport capabilities derived from actual
  consumer contracts. Default adapters remain in runtime construction; business owners do not
  import their implementation types. Audio exposes opaque readiness and commands, not synthesis,
  score or music scheduler objects. Controller ports remain narrower than these composite options.
- Runtime construction and application composition are checked TypeScript. Explicit owned game/run
  state describes initialization and identity-bearing actor references at this composition layer;
  it is never passed as a new universal runtime parameter to controllers. Complete level/navigation
  state exists before actors/controllers are connected. All per-frame readers stay live.
- Session commands retain phase ownership. Typed deferred callbacks connect construction cycles
  before animation starts; registration order and idempotent teardown remain explicit. Existing
  browser diagnostics keep their publication/command-registration timing and gain a finite type;
  diagnostic commands are optional during construction. No service locator or event bus is added.
- Composition translates a structural grapple reference to the concrete actor backend with an
  instance guard. The gameplay grapple protocol stays independent of EnemyActor implementation.
  This preserves valid yank behavior without asserting a whole target to a concrete class.
- Map identity belongs to the checked registry: return the constructed level with the selected
  registered key, retaining its object, arrays, geometry and navigation inputs. Procedural builders
  remain JavaScript and are not claimed to be statically checked by this boundary.
- Grenade reports use three-number tuples and preserve the existing component order/two-decimal
  rounding. Immutable gun/blade flags are literal discriminants, so HUD presentation cannot read gun
  ammunition from a blade. These correct contract mismatches without changing gameplay or packets.
- The legacy committed transport explicitly initializes its alias callback/match flag and documents
  its actual optional host-code/status callback arguments. Its JavaScript body remains unchecked;
  annotating those public parameters does not claim a complete transport implementation migration.

## Alternatives and consequences

Typing a runtime-wide parameter, loosening protocols or casting entire adapters/actors would hide
assembly errors. Separate interface copies would drift from controller requirements. Consumer-derived
capabilities keep replacement requirements honest while default construction knows concrete adapters.
Construction state is deliberately richer than leaf protocols; it is not a new global dependency.

The remaining JavaScript bodies are procedural maps/building, navigation, browser input/HUD/renderer,
committed transport, the sound forwarding facade and shader/re-export content. Their composed tests,
import checks and whole-product coverage remain enabled. Strict mode covers the construction code
and its consumer contracts, not those bodies. Their migration or redesign is separate from claiming
that an interface checks implementation internals.

The construction exceptions remain visible in the structural report: application has 378 physical /
374 code lines and a 355-code-line factory; runtime has 308 physical / 305 code lines and a
268-code-line factory. They cover
initial state, adapter/owner construction, lazy command binding, legacy diagnostics and teardown;
new business policy must go into the corresponding owner. Review size with cohesion and lifetime,
not by splitting a factory at an arbitrary line boundary.

## Evidence

Typechecking the real assembly exposed incomplete input/audio capabilities, a missing session
transport flag, nullable score labels, generic grenade arrays, a widened weapon discriminator and
an actor reference mismatch. The implementation resolves these at their owners/boundaries, without
blanket `any`, `ts-nocheck` or adapter casts. Application/multiplayer, map, grenade, weapon, focus and
screen references pass unchanged. No map, physics, movement or effect fixtures were regenerated.
The independent final review remains deferred at the user's request.

Subsequent [ADR 0028](0028-checked-map-kit-and-stable-recipes.md) checks the reusable map-kit
implementation and authoring contracts while retaining both procedural recipe bodies unchanged.
