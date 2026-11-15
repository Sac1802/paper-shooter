import type { GamePhase } from '../domain/match.js';

export interface DeathState {
  mode: 'solo' | 'ffa';
  menu: boolean;
  deathT: number;
  respawnT: number;
  respawnArm: number;
  promptT: number;
}
export interface DeathInput {
  readonly lastActive: number;
  pressed(action: 'pause'): boolean;
  down(action: 'pause'): boolean;
}
interface DeathPorts {
  state: DeathState;
  input: DeathInput;
  hud: {
    message(title: string, detail: string, duration: number): void;
    key(action: string): string;
  };
  respawn(): void;
  soloReady(): void;
}
/** Advances death timers in real time. Session commands own resulting phase changes. */
export class DeathProgress {
  constructor(private readonly ports: DeathPorts) {}
  update(phase: GamePhase, dt: number) {
    if (phase !== 'dying') return;
    const { state, soloReady } = this.ports;
    state.deathT += dt;
    if (state.mode === 'ffa') this.updateRespawn(dt);
    else if (state.deathT > 1.7) soloReady();
  }
  private updateRespawn(dt: number) {
    const { state, input, hud, respawn } = this.ports;
    const before = Math.ceil(state.respawnT);
    state.respawnT -= dt;
    const left = Math.ceil(state.respawnT);
    if (left > 0) {
      if (left !== before || state.deathT <= dt)
        hud.message(String(left), 'back on the page in', 1.1);
      return;
    }
    if (before > 0) {
      state.respawnArm = input.lastActive;
      state.promptT = 0;
      return;
    }
    if (state.menu) return;
    state.promptT -= dt;
    if (state.promptT <= 0) {
      state.promptT = 1.4;
      hud.message('READY', `press ${hud.key('confirm')} · any button or click to respawn`, 1.5);
    }
    if (input.lastActive !== state.respawnArm && !input.pressed('pause') && !input.down('pause'))
      respawn();
  }
}
