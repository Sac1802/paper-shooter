# 0020 — Own user edits outside screen and loop adapters

Status: Accepted. Date: 2026-11-15.

## Context

Screens directly mutated look settings, music and identity, persisted them and updated input,
audio, player and transport. The keyboard music path repeated the same policy in the loop, while
runtime owned sensitivity conversion. ApplicationOptions required the concrete Preferences class,
including its private storage identity, even though consumers only need loading and writing.

## Decision

UserSettings receives explicit preference state, a write capability, input configuration, music
command and two name targets. It owns sensitivity/inversion application, desired music edits and
name normalization/persistence/synchronization. Checkbox and keyboard paths request the same music
command. Session/audio recovery may still restart playback without changing the user's desired
flag. Initial look application remains at controls setup rather than moving into construction.

SettingsPanel owns settings markup and DOM-to-command translation. It reads a narrow view and
receives sensitivity/inversion/music/name commands; it has no storage, input, audio, actor or
transport access. Settings click/key events retain their propagation boundary so they do not also
activate menu commands. New panels read current preferences when rendered. Retired DOM nodes have
no scheduler or external listener registry; their listeners retire with their nodes as before.

PreferencePort exposes only loading a SavedPreferences record and writing values. The browser
adapter retains namespace migration, fallback random names, numeric bounds and storage-failure
handling. ApplicationOptions now accepts that structural contract instead of a class with private
state. Map, checkpoint and best-score policies are separate from look/music/name editing and remain
with their current owners pending further screen work.

## Alternatives and consequences

Moving DOM handlers into a helper receiving runtime would preserve coupling. Separate UI/keyboard
settings implementations would retain duplicated persistence policy. A general reactive store is
unnecessary for these synchronous commands and would not decide which owner changes a preference.
The small checked owner and browser adapter retain existing save formats and event behavior.

At settings extraction, one SettingsPanel construction/mapping gives `application.js` 323 physical /
318 code lines, with a 302-code-line factory. The reviewed temporary composition exception in
[ADR 0019](0019-focus-policy-motion-and-marker.md) still covers only explicit wiring, development
API and disposal. No new settings calculations move into that factory. Its unchecked typing,
callback ordering and remaining screen/network/loop dependencies remain R2/R5 work; adding another
consumer or lifecycle responsibility requires another review. Warnings remain visible.

## Evidence

Three composed tests passed against `ef18253` before extraction. They cover mouse/gamepad
sensitivity conversion and persistence, inversion, checkbox/keyboard music agreement, newly
rendered settings, trimmed fourteen-character names, blank-name retention and actor/host identity
updates. They pass after extraction with screen/application, focus and weapon references. Two
isolated panel tests cover menu-event isolation and binding screens without settings/name fields.
Existing initial save loading and procedural random draws are unchanged.

Screen routing, map/best state and lobby browsing subsequently gained checked owners in
[ADR 0021](0021-screen-policy-view-and-browse-lifetime.md). Multiplayer binding and runtime
composition remain unchecked JavaScript. Input/HUD/audio/transport options still name concrete
adapters; replacing the preference option alone does not close R2 or R5.
