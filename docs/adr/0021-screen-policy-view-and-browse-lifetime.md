# 0021 — Separate screen policy, views, browser events and lobby lookup lifetime

Status: Accepted. Date: 2026-11-15.

## Context

The screen factory received runtime and mixed HTML, DOM listeners, route/map decisions, records,
transport commands and async lobby caching. It imported map builders and the HUD implementation
to obtain metadata. Import boundaries alone could not expose these responsibilities or prevent a
pending lookup from changing the UI after application disposal.

## Decision

- ScreenController consumes scoped navigation/profile/game/lobby read models, records, transport,
  view and session/connection commands. It owns route selection and intent translation, including
  host map/start authority. It has no DOM, storage adapter, concrete HUD or complete runtime.
  Session commands retain gameplay phase/reset ownership.
- Pure screen views format main/online/lobby/pause/death/prompt and browse output. Their input
  records contain only displayed values. Untrusted names/codes/status/error labels retain escaping.
  Map metadata comes from the domain registry. Input labels/help content have a presentation data
  module independent of HUD construction, with compatibility re-exports from HUD.
- BrowserScreens and its internal bindings own rendering/event translation, settings integration,
  button locking and text/status publication. They receive intent commands rather than roster,
  preference or transport implementations. Map events decode registered keys and ignore unknown
  or disabled map buttons, including clicks on nested labels. New DOM nodes retire old listeners
  with their rendered subtree; no external event registry or scheduler is introduced.
- LobbyBrowser owns browse-cache/busy state, coalescing and publication lifetime. It reads the
  current name and skips lookups during active sessions. A failed lookup publishes an ephemeral
  escaped error while retaining the old empty-cache/retry behavior. Re-rendering does not invent
  a new cache TTL or refresh policy. Signaling endpoint/query cancellation remains with transport;
  application disposal retires screen publication before leaving that transport.
- RunProgress owns best/checkpoint records and persistence. Wave progression still decides when
  to save a checkpoint; the results command requests best-score recording before rendering. Menu
  map preference belongs to UserSettings and does not build/rewrite a map. Existing save formats,
  reset ordering and map geometry remain unchanged.

The application-facing screen commands remain available. Factory internals for raw template/event
helpers are private to their owners rather than becoming an unnecessary public controller API.
An isolated Node test constructs the controller against ports without a browser, world, renderer,
audio engine or concrete peer transport.

## Alternatives and consequences

A typed runtime parameter would retain broad access. Helpers bound to the original factory would
retain shared state and implicit sequencing. A global event bus, router framework or reactive store
would add machinery without defining lifetime, record or host authority. Explicit synchronous
commands preserve reviewable ordering, and one small browse owner handles the asynchronous boundary.

At screen extraction, the composition root has 332 physical / 327 code lines with a 310-code-line factory. The
temporary exception reviewed in ADRs 0019/0020 still covers construction, capability wiring,
development commands and disposal. No navigation/record calculations move into that root; inline
checkpoint persistence moves out. Warnings stay visible. Another controller/consumer/lifecycle
responsibility triggers review; checked entry/runtime composition remains open under R2/R5.

## Evidence

Before extraction, a reference at `430e41e` recorded eleven rendered states: main/progress, busy and
populated lobby browsing, host/follower lobby, online/solo pause, new/existing best and input prompt.
Composed command tests cover nested map selection, checkpoints, Enter-code normalization, Back
availability, rejoin clearing and host/follower map/start authority. Their output remains unchanged.

Two regressions first reproduced lookup success/error publication after disposal. The correction
in `8bfe72d` precedes extraction; both still pass. Four isolated browse tests cover coalescing,
publication order, active-session gating, fresh names, failure/retry and disposal. A browser adapter
test covers invalid/disabled map keys. Existing settings, application, session cancellation and
multiplayer tests remain in force. These checks do not establish real-network latency, GPU/input
acceptance or complete the independent review deferred by the user.

Runtime/entry composition, multiplayer message/idle/synchronization binding, loop binding,
concrete input/HUD/audio/transport options and extracted effects remain open work.
