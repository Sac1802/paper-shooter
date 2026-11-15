# 0016 — Separate match rules, phase commands and score presentation

Status: Accepted. Date: 2026-11-15.

## Context

The match factory received the complete runtime and mixed spawn selection, kill attribution,
network score reports, phase mutation and HTML. Its HUD dependency included DOM element inspection.
Typing that runtime wholesale would preserve the coupling rather than describe the actual needs
of match rules.

## Decision

MatchController receives consumer-defined player/opponent, current-level, score, transport,
feedback and session capabilities. It owns the existing spawn selection, ordered death/score
reports, score parsing/ranking and win checks. Readers resolve the current level, name, clock and
roster; the controller retains no obsolete level collection or concrete actor/transport class.

SessionController accepts explicit player-death, respawn and match-finish commands and owns those
phase writes and initial timers. The match controller preserves the order of report, score, phase
and feedback operations. DeathProgress advances solo death and online respawn/countdown/readiness
timers through scoped state, input, feedback and semantic completion commands. SessionController
owns it and applies the resulting phase changes. The loop supplies its captured frame phase and
unscaled delta after simulation; it no longer writes phases or runs respawn policy.

Pure presentation functions format leaders, the board and results from a score view. They escape
untrusted labels and have no transport, application, DOM or phase mutation dependency. Match HUD
operations use a small port; the composition root supplies board visibility and spawn feedback.
The winner value belongs to the domain, with a type re-export for existing session consumers.

## Alternatives and consequences

Keeping one runtime interface would expose unrelated state. Moving HTML into domain score rules
would couple rules to the browser. An event bus would obscure the synchronous death/score ordering.
The explicit match controller and pure render functions establish those boundaries without an
additional framework or a separate abstraction for every spawn calculation.

The score table is still shared with roster/session owners through explicit capabilities. This is
not a redesign of score authority or an anti-cheat system. Application/runtime construction and
other legacy controllers remain JavaScript boundaries under the open R2/R5 findings.

## Evidence

Four composed characterization tests passed against `9f959e9` before replacing the factory. They
cover safest-three selection and stable distance ties, invisible opponents, local-player inclusion
for late joins, fallback spawns, death-before-score reports, headshots/suicide, fresh-input respawn,
malformed scores, HTML escaping, local rank outside the leaders and host-only win/idempotence.
They pass unchanged against the checked controller, alongside application, multiplayer, session
cancellation, screen and composed-combat regressions. Existing map content, RNG calls and match
constants remain unchanged. These tests do not establish real-network or GPU performance.

A subsequent regression reproduced the host's winning-death report replacing the results phase
with `dying`: score handling finished the match before the pending local-death transition. A
separate correction makes the completed match take precedence over that death transition. Its
integration test follows actual lethal damage through the winning score and subsequent frames.
Five isolated death-progress tests also cover the strict solo delay, countdown zero crossing,
input arming, menu gating, held/pressed pause and readiness-prompt cadence.
