# 0023 — Separate multiplayer idle, replication and clock policy

Status: Accepted. Date: 2026-11-15.

## Context

Multiplayer binding received the entire runtime and mixed roster/packet callbacks with local and
remote inactivity, replica advancement, stale peer recovery, outgoing snapshots/shots and match
clock authority. Domain `idlePolicy` already expressed the thresholds but the binder duplicated
its rules. Testing those policies required complete applications, maps, DOM and actor resources.

## Decision

- IdlePlayers owns one-second polling and warning rearming, uses domain idle policy, and requests
  leave/rejoin/kick commands. It receives role/code/activity readers and remote idle records, with
  no actor creation, DOM, score table or mutable game phase. Rejoin codes are captured before leave
  invalidates the transport. The existing thirty-second snapshot idle flag remains unchanged.
- NetworkSync owns the three-tick snapshot cadence, ordered replica advancement, stale-peer
  handling and shot-queue flushing. It requests migration, roster removal, score/lobby reports and
  clock advancement through capabilities. It retains the existing nine-second stale threshold and
  continues the rest of the captured frame after requesting host recovery.
- MatchClock owns authoritative clock start/report/end policy and follower clock projection.
  It receives only clock state, host role/identity, a ranked-score reader, result command and timer
  output. It cannot change phases, manipulate actors or render a scoreboard. The host waits for
  another player before starting; followers never acquire result authority from elapsed time.
- Clock reception still passes through host-only transport dispatch. All wire formats, packet
  validation, message order, rounding, report intervals and idle limits remain compatible.

The multiplayer binder explicitly supplies these capabilities. Remaining roster/gameplay packet
binding and entry/runtime typing are still open; moving a controller into TypeScript does not
check the JavaScript composition that supplies its ports.

## Alternatives and consequences

A typed runtime parameter or helper functions bound to the existing binder would preserve its
shared authority. One new generic network manager would combine three unrelated state machines.
Scoped protocols permit policy tests in Node alongside composed multiplayer characterization.
No event bus, state container, transport replacement or gameplay timing change is needed.

The delayed kick close remains a transport-lifetime concern in binding, retaining its existing
500 ms delay and captured connection. This extraction does not claim a reproduced timer leak or
change connection-close semantics. Browser/network/device performance still needs real acceptance.

## Evidence

Seven integration tests pass before extraction at the frame checkpoint plus the independent
retired-packet fix. They preserve warning boundaries/rearming, idle host retention, normalized
rejoin, kick-before-close ordering, three-tick snapshots, shot flushing, host start/expiry,
follower clock projection and silent-peer removal. Node policy tests exercise scoped owners
without creating an application or map. Existing two-/three-client gameplay and recovery traces
remain in force; no map or recorded gameplay fixtures are regenerated.

A separate reproduced transport fix precedes extraction: data from a connection retired by leave
or superseded by another channel was still dispatched to gameplay handlers. Transport wiring now
checks both session generation and current connection identity before validation/dispatch, just
as close/error handling already checked identity. Both regressions first failed against the old
code and pass with the fix; the current connection still delivers valid packets.

Subsequent [ADR 0027](0027-checked-construction-and-adapter-capabilities.md) implements the entry/runtime
construction and structural adapter-option work left open at this checkpoint.
