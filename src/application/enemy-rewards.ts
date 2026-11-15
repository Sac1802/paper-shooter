import type { Vector3 } from 'three';
import type { EnemyDeathImpact } from '../domain/enemy-death.js';
import { killReward } from '../domain/kill-rewards.js';
import { KATANA_CHARGE_KILLS } from '../domain/focus.js';
import type { PickupKind } from '../domain/pickups.js';

interface RewardTarget {
  readonly T: { readonly name: string; readonly score: number; readonly boss?: boolean };
  readonly body: { readonly pos: Vector3 };
}
interface RewardPorts {
  state: { kills: number; combo: number; comboT: number; katanaStreak: number };
  grounded(): boolean;
  bladeBlood(amount: number): void;
  enterFocus(): void;
  score(points: number, label: string): void;
  killSound(strong?: boolean): void;
  spawnPickup(kind: PickupKind, point: Vector3): void;
}
/** Ordered reward side effects. Enemy health owns whether a death is notified exactly once. */
export class EnemyRewards {
  constructor(private readonly ports: RewardPorts) {}
  grant(enemy: RewardTarget, impact: EnemyDeathImpact, severed: boolean) {
    const { state, bladeBlood, enterFocus, grounded, score, killSound, spawnPickup } = this.ports;
    state.kills++;
    state.combo++;
    state.comboT = 3.5;
    const reward = killReward(enemy.T, impact, severed);
    if (impact.source === 'katana' || impact.source === 'focus') {
      state.katanaStreak++;
      bladeBlood(0.42);
      if (state.katanaStreak >= KATANA_CHARGE_KILLS) enterFocus();
    } else if (impact.source !== 'blast') state.katanaStreak = 0;
    if (impact.source !== 'fall' && !grounded() && impact.source !== 'deflect') {
      reward.label += ' · AIRBORNE';
      reward.points += 40;
    }
    score(reward.points, reward.label);
    killSound(!!impact.crit || enemy.T.boss);
    const roll = Math.random();
    if (roll < 0.5) spawnPickup('ammo', enemy.body.pos);
    else if (roll < 0.62) spawnPickup('health', enemy.body.pos);
  }
}
