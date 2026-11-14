import { Vector3 } from 'three';
import { damp, rand } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
import type { Body } from '../../engine/physics.js';
import type { BossEnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyAttackClock, DirectedEnemyMotion } from './behavior-contracts.js';
import type { InkblotActions, BossBehavior } from './boss-contracts.js';
import type { PerceivedTarget } from './perception.js';
type Spray = { kind: 'spray'; t: number; shots: number };
type Summon = { kind: 'summon'; t: number; done: boolean };
type Attack = Spray | Summon;
export class InkblotBehavior implements BossBehavior {
  private attack: Attack | null = null;
  private aim = 0;
  private sprays = 0;
  private hopTime = 1;
  private hopping = false;
  private readonly point = new Vector3();
  private readonly direction = new Vector3();
  constructor(
    private readonly definition: BossEnemyDefinition,
    private readonly body: Body,
    private readonly clock: EnemyAttackClock,
    private readonly motion: DirectedEnemyMotion,
    private readonly actions: InkblotActions,
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
    this.attack = active ? (this.attack ?? { kind: 'summon', t: 0.3, done: false }) : null;
  }
  update(dt: number, target: Readonly<PerceivedTarget>) {
    const T = this.definition;
    this.aim = damp(this.aim, target.visible ? 1 : 0, 6, dt);
    if (this.attack) {
      this.tickAttack(dt, target, this.attack);
      return;
    }
    this.hop(dt, target);
    if (this.clock.remaining <= 0 && target.visible) {
      if (this.sprays % 3 === 2) {
        this.attack = { kind: 'summon', t: 0, done: false };
        this.sprays++;
        return;
      }
      if (target.distance < T.range) {
        this.attack = { kind: 'spray', t: 0, shots: 0 };
        return;
      }
    }
    if (!this.hopping) {
      if (target.visible && target.distance < 14 && Math.abs(target.height) < 2)
        this.motion.steer(target.position.x, target.position.z, T.speed, 30, dt);
      else this.motion.follow(dt, target.position, T.speed);
    }
    if (target.visible) this.motion.heading = target.yaw;
  }
  private tickAttack(dt: number, target: Readonly<PerceivedTarget>, attack: Attack) {
    attack.t += dt;
    this.motion.heading = target.yaw;
    this.body.vel.x = damp(this.body.vel.x, 0, 6, dt);
    this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
    if (attack.kind === 'spray') {
      if (attack.t > 0.6 && attack.shots < 9 && attack.t > 0.6 + attack.shots * 0.09)
        this.spray(target, attack);
      if (attack.t > 1.8) {
        this.attack = null;
        this.clock.remaining = rand(this.definition.cool[0], this.definition.cool[1]);
        this.sprays++;
      }
    } else {
      if (attack.t > 0.8 && !attack.done) {
        attack.done = true;
        this.summon();
      }
      if (attack.t > 1.4) {
        this.attack = null;
        this.clock.remaining = rand(this.definition.cool[0], this.definition.cool[1]);
      }
    }
  }
  private spray(target: Readonly<PerceivedTarget>, attack: Spray) {
    this.actions.torso(this.point);
    this.point.y += 0.8;
    const base = Math.atan2(
        target.position.x - this.body.pos.x,
        target.position.z - this.body.pos.z,
      ),
      angle = base + (attack.shots - 4) * 0.19;
    this.direction.set(Math.sin(angle), 0.18 + rand(-0.05, 0.05), Math.cos(angle)).normalize();
    this.actions.emit(this.point, this.direction, {
      speed: 20,
      damage: this.definition.dmg * 0.55 * this.actions.damageModifier(),
      ink: INK.BLACK,
      thickness: 0.3,
      blast: 1,
    });
    attack.shots++;
    if (attack.shots === 1) this.actions.feedback.shot(this.actions.center);
  }
  private summon() {
    this.actions.feedback.inkblotSummon(this.actions.center);
    const alive = this.actions.count('flyer');
    for (let i = 0; i < 3 && alive + i < 6; i++)
      this.actions.spawnReady(
        'flyer',
        this.actions.center.clone().add(this.point.set(rand(-2, 2), 2 + i, rand(-2, 2))),
      );
  }
  private hop(dt: number, target: Readonly<PerceivedTarget>) {
    const body = this.body;
    this.hopTime -= dt;
    if (body.onGround && this.hopTime <= 0 && target.distance > 4) {
      this.hopTime = rand(1.6, 2.4);
      const nx = (target.position.x - body.pos.x) / target.distance,
        nz = (target.position.z - body.pos.z) / target.distance;
      body.vel.set(nx * 11, 13, nz * 11);
      body.onGround = false;
      this.hopping = true;
    }
    if (this.hopping && body.onGround) {
      this.hopping = false;
      this.land();
    }
  }
  private land() {
    const body = this.body;
    this.actions.feedback.inkblotLand(body.pos, this.actions.center);
    for (const target of this.actions.targets()) {
      const distance = Math.hypot(target.body.pos.x - body.pos.x, target.body.pos.z - body.pos.z);
      if (target.alive && distance < 4.5 && Math.abs(target.body.pos.y - body.pos.y) < 2.5) {
        target.takeDamage(
          this.definition.dmg * 0.7 * this.actions.damageModifier(),
          this.actions.center,
        );
        target.knockback(
          this.direction.subVectors(target.center, this.actions.center).normalize(),
          8,
        );
      }
    }
  }
}
