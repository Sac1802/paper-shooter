# 0022 — Separate frame policy, interaction, presentation and scheduling

Status: Accepted. Date: 2026-11-15.

## Context

The loop received runtime and mixed variable-step integration, menu/music/scoreboard input,
HUD/audio/render projection, live level reads and browser scheduler lifetime. Moving individual
helpers without reducing their captured state would retain that coupling. Frame order and the
distinction between real/scaled time are part of gameplay feel and network/session behavior.

## Decision

- GameLoop owns frame capture, the existing 50 ms cap, hitstop/focus scaling, ordered simulation,
  combo/result timers and scheduler lifetime through scoped capabilities. It does not mutate the
  gameplay phase: session commands retain transition ownership. Real delta drives networking,
  spawn protection, death and online supplies; scaled delta drives simulation and solo waves.
- FrameInteraction owns scoreboard hold/toggle state, cursor hints and frame-level input dispatch.
  It requests session/music commands and reads board visibility without a DOM element or runtime.
  Input can change the session while the coordinator still uses its captured phase for that frame.
- FramePresentation projects read-only actor/weapon/game values into HUD, audio and rendering.
  Discriminated weapon data exposes ammunition only for guns. Animation/listener/HUD/intensity/
  rendering order remains explicit; a stale boss is retired through a command. It owns no actor,
  health, network or scheduling policy, and does not construct per-frame state snapshots.
- Checked frame composition wires these independent owners from consumed capabilities, never a
  whole runtime or a helper bound to its manager. Live level/count/visibility readers avoid stale
  captures. Music recovery reads readiness through a capability rather than inspecting WebAudio.
- The platform scheduler exposes time, animation requests/cancellation and background work that
  returns a cancellation function. Timer handles stay inside the adapter. Starting twice creates
  one chain; stopping retires both sources. Background steps retain the existing 250 ms check and
  300 ms starvation threshold and do not create another animation-frame chain.

Captured phase and scale are deliberately not recomputed after input/focus callbacks. Replacing
the integrator with fixed steps, changing timer thresholds or changing pause/online-death behavior
would be gameplay changes requiring another decision and reference.

## Alternatives and consequences

A typed runtime record would retain unrelated authority. A rendering framework or an event bus
would not define frame order or clock ownership. Explicit ports preserve ordered synchronous
effects while allowing fake scheduling and presentation in tests. This does not establish GPU/frame
performance, NAT latency or device acceptance.

The root now has 356 physical / 351 code lines and a 334-code-line factory. Its reviewed temporary
exception still covers explicit construction/mapping, development API and disposal. The added
fields expose frame dependencies rather than hiding runtime in another helper. The checked frame
composition itself supplies each owner only its protocol. Root/runtime typing and concrete adapter
options remain R2/R5 work; another consumer or lifecycle responsibility triggers another review.

## Evidence

Seven tests against `c15ad85` characterize frame phase/order, the 50 ms cap, real/scaled clocks,
pause transitions, online death/menu simulation, keyboard/controller scoreboard behavior, strict
host/follower result delays and background scheduling/retirement. The fixture now supplies explicit
capabilities to the checked composition; the behavior assertions remain unchanged. Existing
composed focus/weapon/enemy/multiplayer/application references remain in force. No procedural
fixtures, map content, frame cap or timeouts were regenerated/changed for this extraction.

Multiplayer message/idle/synchronization binding, runtime/entry composition, concrete input/HUD/
audio/transport options and extracted effects remain open. Independent review remains deferred.
