# 0014 — Separate remote replica state from presentation

Status: Accepted. Date: 2026-11-15.

## Context

RemotePlayer exposed a target for enemies/weapons while also owning packet projection, snapshot
history, interpolation, animation, grapple geometry and ragdoll transfer. It retained the complete
application context although it only needed scene/resource/effect capabilities and a local-eye read.
Remote visuals differ from local first-person weapons/rope and from bot head/attack poses.

## Decision

- The checked RemotePlayer facade owns target flags/read models, model replacement and phase
  sequencing. Its services expose scene, resource/lease ownership, death effects and a local-eye
  reader; no application runtime or local actor is retained. Damage reports expose only target
  identity/aliveness to the consumer. The owner's client still applies physics and health authority.
- The typed domain projection consumes a local-player protocol and preserves the existing eleven-
  or fourteen-number packet: rounded position/angles/velocity, twelve flag bits and optional hook.
  Incoming payload validation remains at the transport boundary under R1.
- RemoteInterpolation owns previous/next poses and interpolation scratch/output. Keep the 80 ms
  display delay, 350 ms extrapolation cap, six-unit correction threshold and exponential smoothing.
  Respawn clears only the previous frame; pose input and borrowed output have explicit lifetimes.
- RemoteAnimation owns gait/phase and consumes a reusable numeric/pose frame plus named model
  joints. Gait continues across model rebuilds as before. Dead pose, guard/gun carry, airborne legs
  and name-tag orientation remain distinct from bot animation. It has no actor or network access.
- RemoteGrapple owns its existing rope/hook geometry, reusable vectors, projection and retirement.
  Preserve its palette/thickness and short-rope handling; sharing local first-person geometry
  would change visuals and is not part of this refactor.
- RemoteRagdoll owns fragment selection, impulses, corpse pose and scene transfer behind rig/pose
  and effect ports. Cached material leases belong to the facade; transferred fragments remain
  owned by effects/SceneResources until retirement. Root transfer occurs before the facade clears
  its root reference. Keep random calls, debris registration and blood/pool ordering.

## Alternatives and consequences

Direct reuse of bot animation would replace owner-supplied pitch/guard poses with bot target/attack
tracking. A single local/remote rope implementation would also require visual-policy changes.
Explicit borrowed frames and independent resource owners retain those differences without an
actor-shaped helper interface. The small actor facade still coordinates snapshot weapon updates,
respawn rebuild and target-pose projection in their original order.

Application construction, combat message policy and several other controllers remain JavaScript
boundaries under R2/R5; checking RemotePlayer does not certify those callers. No transport protocol,
new authoritative server, game balance or map content is introduced by this decision.

## Evidence

A composed reference was recorded against `87fdbe8` before extraction, then replayed after each
boundary change. It captures 43 states with geometry, transforms/hit regions, flags, grapples,
weapon changes, two ragdolls/respawns, debris retirement, resource counts, wire output and random
call counts. It is not regenerated from the extracted implementation. Isolated tests also cover
packet precision/flags, copied history, bounded corrections, independent rope retirement and
borrowed animation frames. Existing multiplayer, weapon, enemy and resource regressions remain in
force. These recording/in-memory checks do not prove real-network latency or device/GPU behavior.
