# 0013 — Own session transitions outside input and screen adapters

Status: Accepted. Date: 2026-11-15.

## Context

The controls factory owned run reset, solo start, multiplayer start and pause/resume. Screens owned
returning to the menu/lobby, while multiplayer coordinated the same mutations through callbacks.
Avoiding import cycles did not establish ownership: a screen could reset gameplay and input setup
needed network, map, scoring and presentation state. Async lobby completion and migration retries
also outlived leaving/disposal, and the match pointer-lock prompt had no owner to cancel its timer.

## Decision

- SessionController owns the sequencing of run/session commands, mode/phase/menu transitions,
  spawn assignment and match entry. It consumes consumer-defined state, player, input, audio,
  transport and presentation capabilities. It receives neither runtime nor a screen/controller
  implementation. Typed methods validate session phases and choose the appropriate transition.
- RunReset owns the run reset recipe and its counters/resources, with explicit level, player,
  enemies, effects, HUD and focus ports. Rebuilding broken props still precedes resets, and entering
  FFA still chooses its map before resetting health and spawning. Changing a map retains live state
  readers rather than capturing an obsolete level.
- The browser controls adapter only owns DOM/input callbacks and their disposal. It translates
  clicks and lock changes to session commands. Screens invoke commands for returning to the main
  menu; they no longer perform that transition or reset gameplay. The composition root preserves
  the existing development/browser automation commands separately from input wiring.
- The session controller owns the delayed pointer-lock prompt. Beginning another session,
  returning to a menu/lobby, leaving online play and disposal cancel it. Presentation renders a
  request; it does not own the timer or decide the transition.
- DeathProgress advances death/respawn timers, prompt cadence and fresh-input eligibility using
  real frame delta. SessionController applies its resulting phase changes; the loop only supplies
  the captured frame phase after simulation. See [ADR 0016](0016-match-rules-and-presentation.md).
- SessionTasks owns an async session generation. Leaving, replacing pending work or disposal
  invalidates previous completions/progress/errors and settles cancelled backoff waits immediately.
  A finished migration retains its generation for later alias reclamation until cancellation.
  Network transport cancellation remains a separate lower-layer responsibility.
- LobbyConnection owns connect/create/quick-play/leave transactions, roster/score teardown and
  progress/error publication. HostMigration owns successor election, generation codes, bounded
  host/follower retries and alias recovery through a smaller capability contract. They request
  phase transitions from SessionController; neither receives the runtime, game record or DOM.
  The session owner adopts clock authority before alias setup and presents recovery afterward,
  preserving the original ordering, including failure during alias setup. Plain-text connection
  feedback belongs to a separate presentation function.

## Alternatives and consequences

A global event bus or moving methods to functions bound to runtime would retain implicit shared
state. A generic state-machine library is unnecessary for these explicit transitions and would
not decide who owns network retries, map reset or input lifetimes. Separate checked owners make
that sequencing reviewable while retaining the existing variable-step gameplay.

This is incremental. Runtime composition, screens, multiplayer message dispatch, focus and loop
adapters still have JavaScript boundaries. Multiplayer still binds gameplay
messages, idle policy and synchronization through runtime access. Screens still combine read models,
settings and DOM wiring. This ADR does not close all of R2 or R5.

## Evidence

Composed regressions preserve solo start/pause/resume/death, FFA start/late join/results/lobby return,
map replacement and host migration. Existing movement, camera, weapon and ten-enemy host/client
fingerprints remain unchanged. Reproduced cancellation regressions cover stale success/error,
replacement progress, Back navigation, migration backoff and disposal. Additional cases cover
prompt retirement and a new solo run started before an old match prompt fires. A three-client
session verifies a follower reconnecting to the elected successor with its previous score. Isolated
recovery tests bound successor/follower failure retries and preserve clock/alias/presentation order. These deterministic
checks do not establish real-network latency, NAT reachability or GPU/device performance.
