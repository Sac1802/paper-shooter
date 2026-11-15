# Architecture decision records

| Record                                                        | Decision                                                               | Status   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| [0001](0001-development-toolchain.md)                         | pnpm, Vite and an optional container environment                       | Accepted |
| [0002](0002-networking-and-credentials.md)                    | Browser WebRTC with configurable signaling and ICE                     | Accepted |
| [0003](0003-modular-architecture.md)                          | Modular application with a typed functional core                       | Accepted |
| [0004](0004-deployment.md)                                    | Static artifact and optional Node credential service                   | Accepted |
| [0005](0005-testing.md)                                       | Behavior tests and honest whole-product coverage                       | Accepted |
| [0006](0006-maintainability-standard.md)                      | Size, complexity and semantic-coupling review                          | Accepted |
| [0007](0007-module-size-threshold.md)                         | Researched 300-line module-review threshold; amends 0006               | Accepted |
| [0008](0008-scene-resource-ownership.md)                      | Shared scene resources, fragment transfer and explicit leases          | Accepted |
| [0009](0009-presentation-ownership.md)                        | Separate recipes, simulation, scheduling and presentation lifetimes    | Accepted |
| [0010](0010-player-state-ownership.md)                        | Independent player state owners and explicit phase coordination        | Accepted |
| [0011](0011-weapon-mechanics-and-presentation.md)             | Independent mechanics, impact rules and weapon presentation            | Accepted |
| [0012](0012-enemy-boundaries.md)                              | Enemy queries, projectile simulation and character presentation        | Accepted |
| [0013](0013-session-transition-ownership.md)                  | Session transition, reset and asynchronous lifetime ownership          | Accepted |
| [0014](0014-remote-replica-and-presentation.md)               | Remote snapshot, interpolation and presentation ownership              | Accepted |
| [0015](0015-combat-capabilities-and-composition.md)           | Scoped combat policy, feedback, reports and explicit composition       | Accepted |
| [0016](0016-match-rules-and-presentation.md)                  | Match rules, phase commands and pure score presentation                | Accepted |
| [0017](0017-pickup-policy-and-presentation.md)                | Pickup collection/authority policy, models and retained palette        | Accepted |
| [0018](0018-wave-progression-and-rewards.md)                  | Solo progression, spawn policy, reward commands and event binding      | Accepted |
| [0019](0019-focus-policy-motion-and-marker.md)                | Focus policy, dash motion, marker projection and composition review    | Accepted |
| [0020](0020-user-settings-and-preference-port.md)             | User preference edits, DOM commands and structural persistence         | Accepted |
| [0021](0021-screen-policy-view-and-browse-lifetime.md)        | Screen policy, pure views, DOM commands, records and browse lifetime   | Accepted |
| [0022](0022-frame-policy-projection-and-scheduling.md)        | Frame policy, interaction, presentation and cancellable scheduling     | Accepted |
| [0023](0023-multiplayer-idle-replication-and-clock.md)        | Scoped multiplayer idle, replication and clock owners                  | Accepted |
| [0024](0024-incoming-combat-policy-and-feedback.md)           | Incoming combat policy and remote combat feedback                      | Accepted |
| [0025](0025-remote-roster-reconciliation.md)                  | Remote membership, identity replacement and roster reconciliation      | Accepted |
| [0026](0026-checked-multiplayer-composition.md)               | Checked multiplayer composition and consumed transport/actor protocols | Accepted |
| [0027](0027-checked-construction-and-adapter-capabilities.md) | Checked application construction and injectable adapter capabilities   | Accepted |
| [0028](0028-checked-map-kit-and-stable-recipes.md)            | Checked reusable map kit with unchanged procedural recipes             | Accepted |
| [0029](0029-independent-lobby-namespaces.md)                  | Independent Paper lobby discovery on shared signaling infrastructure   | Accepted |

Each decision records context, alternatives, consequences and evidence. Revisit a decision when its
constraints change; retain superseded records so their reasoning remains available.
