import { Vector3 } from 'three';
import { damp, rand, TAU } from '../../engine/math.js';
import type { Body } from '../../engine/physics.js';
import type { BossEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyAttackClock, DirectedEnemyMotion } from './behavior-contracts.js';
import type { EraserActions, BossBehavior } from './boss-contracts.js';
import type { PerceivedTarget } from './perception.js';
type Charge = { kind: 'charge'; t: number; hit: boolean; dir: Vector3 | null };
type Rub = { kind: 'rub'; t: number; done: boolean };
type Attack = Charge | Rub;
export class EraserBehavior implements BossBehavior {
  private attack: Attack | null = null;
  private aim = 0;
  private charges = 0;
  private readonly point = new Vector3();
  private readonly direction = new Vector3();
  constructor(
    private readonly definition: BossEnemyDefinition,
    private readonly body: Body,
    private readonly clock: EnemyAttackClock,
    private readonly motion: DirectedEnemyMotion,
    private readonly actions: EraserActions,
  ) {}
  get attackPose(): Readonly<Attack> | null {
    return this.attack;
  }
  get aimAmt() {
    return this.aim;
  }
  applyAim(amount: number) {
    this.aim = amount;
  }
  idle(dt: number) {
    this.body.vel.x = damp(this.body.vel.x, 0, 6, dt);
    this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
    this.aim = damp(this.aim, 0, 5, dt);
  }
  applyAttack(active: boolean) {
    this.attack = active ? (this.attack ?? { kind: 'rub', t: 0.3, done: false }) : null;
  }
  update(dt: number, target: Readonly<PerceivedTarget>) {
    this.aim = damp(this.aim, 0, 6, dt);
    if (this.attack) {
      const attack = this.attack;
      attack.t += dt;
      if (attack.kind === 'charge') this.charge(dt, target, attack);
      else this.rub(dt, target, attack);
      return;
    }
    const T = this.definition;
    if (this.clock.remaining <= 0 && target.visible) {
      if (this.charges % 3 === 2 && target.distance < 12) {
        this.attack = { kind: 'rub', t: 0, done: false };
        this.charges++;
        return;
      }
      if (target.distance < T.range && target.distance > 3) {
        this.attack = { kind: 'charge', t: 0, hit: false, dir: null };
        return;
      }
    }
    if (target.visible && target.distance < 16 && Math.abs(target.height) < 2)
      this.motion.steer(target.position.x, target.position.z, T.speed, 30, dt);
    else this.motion.follow(dt, target.position, T.speed);
    if (target.visible) this.motion.heading = target.yaw;
  }
  private charge(dt: number, target: Readonly<PerceivedTarget>, attack: Charge) {
    const body = this.body;
    if (attack.t < 0.7) {
      this.motion.heading = target.yaw;
      body.vel.x = damp(body.vel.x, 0, 8, dt);
      body.vel.z = damp(body.vel.z, 0, 8, dt);
      if (attack.t > 0.55 && !attack.dir) {
        attack.dir = new Vector3(
          target.position.x - body.pos.x,
          0,
          target.position.z - body.pos.z,
        ).normalize();
        this.actions.feedback.roar(this.actions.center);
      }
    } else if (attack.t < 1.9) {
      const direction = attack.dir;
      if (!direction) throw new Error('Charge direction must be captured during its windup');
      body.vel.x = direction.x * 17 * this.actions.speedModifier();
      body.vel.z = direction.z * 17 * this.actions.speedModifier();
      this.chargeImpact(attack);
      if (body.hitWall) {
        attack.t = 1.9;
        this.actions.feedback.eraserWall(this.actions.center);
      }
      if (Math.floor(attack.t * 10) !== Math.floor((attack.t - dt) * 10))
        this.actions.feedback.eraserTrail(body.pos);
    } else {
      body.vel.x = damp(body.vel.x, 0, 4, dt);
      body.vel.z = damp(body.vel.z, 0, 4, dt);
      if (attack.t > 2.7) {
        this.attack = null;
        this.clock.remaining = rand(this.definition.cool[0], this.definition.cool[1]);
        this.charges++;
      }
    }
  }
  private chargeImpact(attack: Charge) {
    const body = this.body;
    for (const target of this.actions.targets()) {
      if (!target.alive) continue;
      const distance = Math.hypot(target.body.pos.x - body.pos.x, target.body.pos.z - body.pos.z);
      if (distance < 2.6 && Math.abs(target.body.pos.y - body.pos.y) < 3 && !attack.hit) {
        attack.hit = true;
        target.takeDamage(this.definition.dmg * this.actions.damageModifier(), this.actions.center);
        target.knockback(
          this.direction.subVectors(target.center, this.actions.center).setY(0.2).normalize(),
          13,
        );
        this.actions.feedback.shake(0.5);
      }
    }
  }
  private rub(dt: number, target: Readonly<PerceivedTarget>, attack: Rub) {
    this.motion.heading = target.yaw;
    this.body.vel.x = damp(this.body.vel.x, 0, 6, dt);
    this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
    if (attack.t > 0.9 && !attack.done) {
      attack.done = true;
      this.scrub();
    }
    if (attack.t > 1.6) {
      this.attack = null;
      this.clock.remaining = rand(this.definition.cool[0], this.definition.cool[1]);
    }
  }
  private scrub() {
    const body = this.body;
    this.actions.feedback.eraserRub(body.pos, this.actions.center);
    const alive = this.actions.count('bomber');
    for (let i = 0; i < 2 && alive + i < 4; i++) {
      const angle = rand(0, TAU);
      this.actions.spawnReady(
        'bomber',
        body.pos.clone().add(this.point.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3)),
      );
    }
    for (const target of this.actions.targets()) {
      const distance = Math.hypot(target.body.pos.x - body.pos.x, target.body.pos.z - body.pos.z);
      if (target.alive && distance < 6.5 && target.body.pos.y < body.pos.y + 3) {
        target.takeDamage(
          this.definition.dmg * 0.8 * this.actions.damageModifier(),
          this.actions.center,
        );
        target.knockback(
          this.direction.subVectors(target.center, this.actions.center).normalize(),
          9,
        );
      }
    }
  }
}
