# 0026 — Check multiplayer composition through consumed protocols

Status: Accepted. Date: 2026-11-15.

## Context

After extracting idle, synchronization, clock, incoming combat, feedback and roster owners, the
multiplayer factory still received the entire unchecked runtime. Typed leaves alone would not
check packet callback wiring or prevent new dependencies on unrelated runtime services.

## Decision

The multiplayer factory is checked TypeScript and accepts explicit multiplayer capabilities plus
session/match/pickup/prop commands. Composition supplies each independent owner its own protocol.
The replica protocol combines only membership, interpolation, idle, shot/death presentation and
remote damage callback capabilities; it does not name the concrete RemotePlayer class. The factory
constructs that adapter from finite RemoteServices and registers its ordered grenade report.

Transport callbacks are generic over the decoded message mapping, so event names determine payload
shapes. Host-only reception remains enforced by the transport before callbacks run. Session/clock
owners retain phase/authority policy; the factory binds current profile, level and pickup readers.
The boundary explicitly handles absent disconnected identities instead of sending malformed/null
host ids or pretending a missing local identity indexes a spawn/score table.

Application composition now supplies these capabilities explicitly. Neither a typed runtime alias,
manager-bound helper, service locator nor blanket `any` annotation is introduced. Runtime/entry
bodies and remaining concrete adapter option types still need R2/R5 work. Strict TypeScript does
not check the JavaScript that supplies these ports.

## Composition review

Multiplayer has 304 physical / 299 code lines, with a 282-code-line factory. This is an explicit
composition/registration exception to the function review threshold: it assembles independent
owners, registers ordered callbacks and exposes the application API. Small pickup/prop/fall packet
adapters remain here; their mutation policy is still delegated through supplied actor/controller
commands. A new independent policy or additional callback domain triggers another review rather
than unbounded factory growth. Its size warning remains visible in the advisory report.

Application composition has 376 physical / 371 code lines and a 354-code-line factory, extending the
temporary exception in ADR 0022. The increase exposes the multiplayer inputs previously hidden in
a runtime parameter. It adds no map/rendering/gameplay calculations to the root. Entry/runtime
checking and construction/lifetime composition remain open; these exceptions do not declare them
finished or justify splitting at an arbitrary physical line.

## Evidence

Checked owner tests run in Node without application/map/browser construction. Existing composed
map/snapshot/damage/pickup/score/clock/end and three-client recovery tests remain unchanged. New
pre-extraction idle/frame, incoming-combat and roster assertions also pass through the checked
factory, including late-join payload order and reconnecting score retention. No recorded map or
valid gameplay fixtures were regenerated. The independent final review remains deferred.

A separate post-extraction regression reproduced silent-host recovery losing the successor identity:
NetworkSync retired the transport before HostMigration captured its id. HostMigration now captures
its election context before retiring the old endpoint; NetworkSync requests recovery without
clearing that identity. A two-client timeout scenario and Node successor/follower teardown tests
verify recovery and rejoin metadata. The update still completes its captured frame remainder.

Subsequent [ADR 0027](0027-checked-construction-and-adapter-capabilities.md) implements the entry/runtime
construction and structural adapter-option work left open at this checkpoint.
