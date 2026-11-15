import { formatClock, type Score, type Winner } from '../domain/match.js';
import type { GamePayloads } from '../network/game-message-types.js';
export interface MatchClockPorts {
  state: { matchLeft: number; clockRunning: boolean; clockT: number };
  game: { clockStarted: boolean; readonly over: unknown; matchT: number };
  transport: {
    readonly isHost: boolean;
    readonly id: string | null;
    send<K extends 'clock' | 'end'>(kind: K, data: GamePayloads[K]): void;
  };
  inMatch(): boolean;
  opponentCount(): number;
  localName(): string;
  sortedScores(): Array<[string, Score]>;
  timer(text: string): void;
  end(winner: Winner): void;
}
/** Host starts/finishes the clock; followers only project the last authoritative clock. */
export class MatchClock {
  constructor(private readonly ports: MatchClockPorts) {}
  receive(clock: GamePayloads['clock']) {
    if (this.ports.transport.isHost) return;
    this.ports.state.matchLeft = clock.left;
    this.ports.state.clockRunning = !!clock.on;
  }
  update(dt: number) {
    const { state, game, transport, inMatch, opponentCount, timer } = this.ports;
    if (transport.isHost && inMatch() && opponentCount() > 0) game.clockStarted = true;
    const on =
      inMatch() && !game.over && (transport.isHost ? !!game.clockStarted : state.clockRunning);
    if (inMatch() && !game.over) {
      if (on) state.matchLeft = Math.max(0, state.matchLeft - dt);
      if (transport.isHost) {
        state.clockT -= dt;
        if (state.clockT <= 0) {
          state.clockT = 2;
          transport.send('clock', { left: Math.round(state.matchLeft), on });
        }
      }
      timer(on ? formatClock(state.matchLeft) : 'clock starts when someone joins');
    }
    if (transport.isHost && on) {
      game.matchT += dt;
      if (state.matchLeft <= 0) this.finish();
    }
  }
  private finish() {
    const { sortedScores, transport, localName, end } = this.ports;
    const first = sortedScores()[0];
    // An active host always has an identity; a disconnected clock has no result authority.
    let winner: Winner;
    if (first) winner = { id: first[0], name: first[1].name };
    else {
      const id = transport.id;
      if (id === null) return;
      winner = { id, name: localName() };
    }
    transport.send('end', winner);
    end(winner);
  }
}
