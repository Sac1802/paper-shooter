import { Vector3 } from 'three';
import { clamp } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
import type { WeaponImpact } from '../weapons/impact-contracts.js';
import type { PlayerHitReceipt } from '../player/services.js';
export interface PvpOpponent {
  readonly id: string;
  readonly alive: boolean;
  readonly center: Vector3;
  readonly forward: Vector3;
  readonly blocking: boolean;
  readonly parryWindow: boolean;
  flash(): void;
}
export interface PvpDamagePorts<T extends PvpOpponent> {
  canHurt(target: T): boolean;
  local: {
    readonly center: Vector3;
    readonly eye: Vector3;
    lastHitBy: string | null;
    lastHit: PlayerHitReceipt | null;
    takeDamage(amount: number, point: Vector3): void;
  };
  postponeMelee(duration: number): void;
  hitstop(duration: number, scale: number): void;
  effects: {
    strokeBurst(
      point: Vector3,
      ink: number,
      count: number,
      speed: number,
      options: { life: number; size: number },
    ): void;
    tracer(from: Vector3, to: Vector3, ink: number, thickness: number, life: number): void;
    blood(point: Vector3, direction: Vector3, amount: number, options: { ink: number }): void;
  };
  audio: { shieldHit(point: Vector3): void; hitEnemy(point: Vector3): void };
  hud: {
    tip(text: string, duration: number): void;
    hitmarker(kill: boolean, critical: boolean): void;
  };
  rumble(strong: number, weak: number, milliseconds: number): void;
  reportGuard(id: string, returned: boolean): void;
  reportDamage(
    id: string,
    amount: number,
    origin: Vector3,
    critical: boolean,
    source: string,
  ): void;
}
/** Owns player-hit/guard policy and semantic reports; networking format and actor implementations stay outside. */
export class PvpDamage<T extends PvpOpponent> {
  private readonly direction = new Vector3();
  constructor(private readonly ports: PvpDamagePorts<T>) {}
  hit(target: T, amount: number, impact: WeaponImpact) {
    if (!this.ports.canHurt(target) || !target.alive) return;
    if (impact.part === 'blade') {
      this.guard(target, amount, impact);
      return;
    }
    const facing = target.blocking
      ? this.direction
          .subVectors(this.ports.local.center, target.center)
          .normalize()
          .dot(target.forward)
      : -1;
    const front = /^(head|torso|arm|fore)/.test(impact.part);
    if (facing > 0.6 && front && impact.source === 'katana' && target.parryWindow) {
      this.parry(target, impact.point);
      return;
    }
    this.ports.effects.blood(impact.point, impact.dir, clamp(0.4 + amount / 80, 0.4, 1.6), {
      ink: INK.RED,
    });
    this.ports.hud.hitmarker(false, impact.crit);
    this.ports.audio.hitEnemy(target.center);
    target.flash();
    this.ports.reportDamage(target.id, amount, this.ports.local.center, impact.crit, impact.source);
  }
  private guard(target: T, amount: number, impact: WeaponImpact) {
    const { effects, audio, hud, local } = this.ports;
    effects.strokeBurst(impact.point, INK.ORANGE, 8, 6, { life: 0.22, size: 0.035 });
    audio.shieldHit(target.center);
    const returned = Math.random() < 0.4;
    if (returned) {
      effects.tracer(impact.point, local.eye, INK.RED, 0.03, 0.08);
      hud.tip('RETURNED', 0.9);
      this.ports.rumble(0.5, 0.4, 90);
      local.lastHitBy = target.id;
      local.lastHit = {
        from: target.center.toArray(),
        crit: false,
        amount: amount * 0.6,
        src: 'deflect',
      };
      local.takeDamage(amount * 0.6, target.center);
    } else hud.tip('DEFLECTED', 0.7);
    this.ports.reportGuard(target.id, returned);
  }
  private parry(target: T, point: Vector3) {
    this.ports.effects.strokeBurst(point, INK.ORANGE, 10, 6, { life: 0.25, size: 0.04 });
    this.ports.audio.shieldHit(target.center);
    this.ports.hitstop(0.08, 0.15);
    this.ports.postponeMelee(0.6);
    this.ports.rumble(0.6, 0.3, 90);
    this.ports.hud.tip('PARRIED', 0.9);
  }
}
