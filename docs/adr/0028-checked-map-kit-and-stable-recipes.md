# 0028 — Check the reusable map kit without editing map recipes

Status: Accepted. Date: 2026-11-15.

## Context

The registry exposed a MapKit inferred from JavaScript. Primitive arguments and produced arrays
therefore remained loosely typed even for a future TypeScript map. Importing authoring types from
the registry would also create a dependency back to the module that registers that new builder.
The user explicitly requires retaining the existing map, not redesigning its content.

## Decision

- The reusable builder is checked TypeScript. Produced level data has explicit vector, animation,
  mesh, grapple-mover and live breakable shapes. Readonly gap tuples describe optional bottom/top
  cuts; primitive options name the flags/dimensions actually consumed by each operation.
- The kit receives scene values and a narrow collision-production port (addBox/finalize), not an
  application runtime or actor manager. Gameplay policy consumes structurally compatible data
  through its own protocols; maps do not import gameplay implementations.
- The wall-opening interval calculation is a pure typed helper shared by the two wall axes. It has
  no scene, world or kit access. Existing clipping, grouping, ordering and tolerances stay exact.
- Authoring types are exported from the builder/contracts, independently of registry registration.
  The registry keeps its compatibility type re-exports. New map modules should import MapKit or
  MapBuilder from the builder to avoid a registry-to-builder-to-registry dependency.
- Keep object-key geometry batching order, primitive construction order, collider finalization,
  random draws, arena choices, positions and dimensions unchanged. Failed geometry merging now
  produces an explicit invariant error at the same boundary that previously failed implicitly.

District and Mexico recipe bodies remain unchanged JavaScript. Their contents are protected by
seeded references, not claimed to be statically checked by the kit. Dynamic map generation and
redesign remain future work; the typed construction seam supports them without implementing them.

## Review scope and consequences

The builder factory deliberately groups primitive authoring commands and their shared palette/
output ownership. Geometry commands retain their existing positional coordinates and optional
named configuration; their arity warnings remain visible. This avoids rewriting map recipes just
to satisfy a metric. A new primitive or topology lifecycle requires another ownership/API review.

A universal engine interface or a data-driven map format would broaden the task and change how
content is authored. Casting the whole kit would hide errors instead of checking its implementation.
Explicit producer contracts and the pure interval helper improve reuse without either change.

## Evidence

The compiler checks actual application/actor/controller construction against the produced level.
Seeded solo/arena map references retain their geometry/collider/spawn output, including collider
counts 517, 429, 321 and 321. Application, weapon, focus and resource traces also pass. Neither map
recipe nor any recorded geometry/behavior fixture is regenerated for this change. Independent
final review remains deferred; graphics/audio and real-network acceptance remain separate checks.
