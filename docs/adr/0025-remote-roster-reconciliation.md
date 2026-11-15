# 0025 — Give remote roster reconciliation explicit ownership

Status: Accepted. Date: 2026-11-15.

## Context

The multiplayer binder mixed replica construction/retirement, roster publication, migration
identity replacement and late-join synchronization. Its callbacks also edited score membership,
so retiring a previous identity incorrectly could lose the transferred score. Roster policy did
not need actor rendering, damage, input, audio or map construction.

## Decision

RemoteRoster owns membership, ordered publication/reconciliation and late-join synchronization.
It receives a peer factory and a lifecycle/name protocol. A type parameter preserves the concrete
peer result for its caller while the owner consumes only that protocol. It cannot apply damage,
construct actor models, elect a host, mutate phases or access DOM. Live map/phase/broken-prop readers
avoid stale level captures. A renamed existing peer retains its instance and resources.

When a reconnecting peer declares a previous string identity, transfer its existing score before
publishing the new roster, retire its old replica, remove the old membership/order entry and retain
the score object/name as before. Treat PeerJS metadata as unknown and read guarded string fields;
this is not proof of ownership of a claimed previous identity or an anti-cheat redesign.

Roster publication/reception retains map, displayed alias, player order, default scores and the
sequence of peer retirement, score refresh and UI rendering. Late joins retain the existing spawn
selection and broken-prop payload. An invalid/disconnected identity emits no malformed roster;
valid connected messages are unchanged.

## Alternatives and consequences

Moving all networking into one typed manager would preserve unrelated authority. An actor registry
alone would not own roster/score reconciliation. A narrow factory and lifecycle protocol keep those
operations together and permit Node tests without game rendering, physics or signaling.

## Evidence

Two application tests pass against `8b01ada` before extraction and retain their assertions afterward:
reconnecting score transfer and exact late-join payload/order; received roster reconciliation before
score refresh and retirement of absent peers. Node tests verify peer reuse/retirement and guarded
metadata. Existing three-client migration retains the follower score through real in-memory
transport/session composition. These checks do not establish real-network reachability or ownership
of an arbitrary reconnecting identity. Final independent review remains deferred.
