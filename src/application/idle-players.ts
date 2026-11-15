import { idlePolicy } from '../domain/match.js';
export const IDLE_FLAG_SECONDS = 30;
export interface IdlePorts {
  transport: {
    readonly active: boolean;
    readonly isHost: boolean;
    readonly aliasCode?: string | null;
    readonly code: string | null;
  };
  opponents(): Iterable<readonly [string, { readonly idle: boolean; readonly idleSince: number }]>;
  inMatch(): boolean;
  idleSeconds(): number;
  now(): number;
  warn(): void;
  kick(id: string): void;
  leave(reason: string): void;
  rejoin(code: string | null): void;
}
/** Owns warning/throttle state and idle policy; transport retains connection lifetime. */
export class IdlePlayers {
  private warned = false;
  private checkTime = 0;
  constructor(private readonly ports: IdlePorts) {}
  update(dt: number) {
    const { transport, opponents, inMatch, idleSeconds, warn, leave, rejoin } = this.ports;
    if (!transport.active) {
      this.warned = false;
      return;
    }
    this.checkTime -= dt;
    if (this.checkTime > 0) return;
    this.checkTime = 1;
    const idle = idleSeconds();
    const othersActive = [...opponents()].some(([, opponent]) => !opponent.idle);
    const policy = idlePolicy(inMatch(), transport.isHost, othersActive, idle);
    if (policy.warn && !this.warned) {
      this.warned = true;
      warn();
    }
    // Rearm on activity, not merely because an active guest temporarily protects an idle host.
    if (idle <= policy.limit - 20) this.warned = false;
    if (policy.drop) {
      const back = transport.isHost ? null : this.rejoinCode();
      leave(transport.isHost ? 'lobby closed: everyone was idle' : 'kicked for inactivity');
      rejoin(back);
      return;
    }
    if (transport.isHost) this.retireIdleGuests(policy.limit);
  }
  kicked(reason: string) {
    const back = this.rejoinCode();
    this.ports.leave(reason || 'kicked');
    this.ports.rejoin(back);
  }
  private rejoinCode() {
    const { transport } = this.ports;
    return String(transport.aliasCode || transport.code || '').replace(/-\d+$/, '');
  }
  private retireIdleGuests(limit: number) {
    const { opponents, now, kick } = this.ports;
    for (const [id, opponent] of opponents()) {
      if (!opponent.idle || !opponent.idleSince) continue;
      if (now() / 1000 - opponent.idleSince <= limit - IDLE_FLAG_SECONDS + 15) continue;
      kick(id);
    }
  }
}
