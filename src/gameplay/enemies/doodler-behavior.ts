import { Vector3 } from 'three';
import { damp, rand } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
import type { Body } from '../../engine/physics.js';
import type { BossEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyAttackClock, DirectedEnemyMotion } from './behavior-contracts.js';
import type { DoodlerActions, BossBehavior } from './boss-contracts.js';
import type { PerceivedTarget } from './perception.js';
type Attack = { kind: 'stomp' | 'throw'; t: number; done: boolean };
export class DoodlerBehavior implements BossBehavior {
  private attack: Attack | null = null;
  private aim = 0;
  private readonly point = new Vector3();
  private readonly direction = new Vector3();
  constructor(
    private readonly definition: BossEnemyDefinition,
    private readonly body: Body,
    private readonly clock: EnemyAttackClock,
    private readonly motion: DirectedEnemyMotion,
    private readonly actions: DoodlerActions,
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
    this.attack = active ? (this.attack ?? { kind: 'stomp', t: 0.3, done: false }) : null;
  }
  update(dt: number, target: Readonly<PerceivedTarget>) {
    if (this.attack) {
      this.tickAttack(dt, target, this.attack);
      return;
    }
    const T = this.definition;
    this.aim = damp(this.aim, target.visible ? 1 : 0, 6, dt);
    if (this.clock.remaining <= 0 && target.visible) {
      if (target.distance < 7 && Math.abs(target.height) < 3) {
        this.attack = { kind: 'stomp', t: 0, done: false };
        this.actions.feedback.roar(this.actions.center);
        return;
      }
      if (target.distance < T.range) {
        this.attack = { kind: 'throw', t: 0, done: false };
        return;
      }
    }
    if (target.visible && target.distance < 14 && Math.abs(target.height) < 2)
      this.motion.steer(target.position.x, target.position.z, T.speed, 30, dt);
    else this.motion.follow(dt, target.position, T.speed);
    if (target.visible) this.motion.heading = target.yaw;
  }
  private tickAttack(dt: number, target: Readonly<PerceivedTarget>, attack: Attack) {
    attack.t += dt;
    this.motion.heading = target.yaw;
    this.body.vel.x = damp(this.body.vel.x, 0, 5, dt);
    this.body.vel.z = damp(this.body.vel.z, 0, 5, dt);
    if (attack.kind === 'stomp') {
      if (attack.t > 0.75 && !attack.done) {
        attack.done = true;
        this.stomp();
      }
      if (attack.t > 1.3) {
        this.attack = null;
        this.clock.remaining = rand(this.definition.cool[0], this.definition.cool[1]);
      }
    } else {
      if (attack.t > 0.6 && !attack.done) {
        attack.done = true;
        this.throwInk(target.center);
      }
      if (attack.t > 1) {
        this.attack = null;
        this.clock.remaining = rand(this.definition.cool[0] * 0.6, this.definition.cool[1] * 0.6);
      }
    }
  }
  private stomp() {
    const body = this.body;
    this.actions.feedback.doodlerStomp(body.pos, this.actions.center);
    for (const target of this.actions.targets()) {
      const distance = Math.hypot(target.body.pos.x - body.pos.x, target.body.pos.z - body.pos.z);
      if (target.alive && distance < 7.5 && target.body.pos.y < body.pos.y + 2.5) {
        target.takeDamage(this.definition.dmg * this.actions.damageModifier(), this.actions.center);
        target.knockback(
          this.direction.subVectors(target.center, this.actions.center).normalize(),
          9,
        );
      }
    }
    this.actions.blast(body.pos, 6, 60);
  }
  private throwInk(target: Vector3) {
    this.actions.head(this.point);
    this.point.y += 1;
    this.direction.subVectors(target, this.point);
    const distance = this.direction.length();
    this.direction.divideScalar(distance);
    this.direction.y += distance * 0.012;
    this.direction.normalize();
    this.actions.emit(this.point, this.direction, {
      speed: 24,
      damage: this.definition.dmg * 0.9,
      ink: INK.BLACK,
      thickness: 0.4,
      blast: 1,
    });
    this.actions.feedback.shot(this.actions.center);
  }
}
