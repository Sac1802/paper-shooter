import type { Vector3 } from 'three';
import { TYPES, type EnemyKind, type EnemyState } from '../../domain/enemies.js';
import type { EnemyDefinition } from '../../domain/enemy-definitions.js';
import { makeBody } from '../../engine/physics.js';
import { damp } from '../../engine/math.js';
import { buildEnemyModel } from '../../presentation/models/enemy.js';
import { composeEnemy, type EnemyComponents } from './actor-composition.js';
import { drawEnemySeed } from './seed.js';
import type { EnemyActorServices, EnemyActorRef, EnemyTarget } from './actor-contracts.js';
/** Checked entity composition and actor-facing API. Mechanics and presentation retain their own state. */
export class EnemyActor implements EnemyActorRef {
  id = 0;
  state: EnemyState = 'spawn';
  t = 0;
  stunDur = 0;
  deadT = 0;
  rootDetached = false;
  target: EnemyTarget | null = null;
  retargetT = 0;
  private legacyAim = 0;
  readonly T: EnemyDefinition;
  readonly model;
  readonly body;
  readonly center;
  readonly root;
  readonly mat;
  readonly parts;
  readonly J;
  readonly tip;
  readonly face;
  readonly components: EnemyComponents;
  yaw: number;
  constructor(
    readonly type: EnemyKind,
    position: Vector3,
    slot: number,
    services: EnemyActorServices,
  ) {
    const T: EnemyDefinition = TYPES[type];
    this.T = T;
    const model = buildEnemyModel(T);
    this.model = model;
    this.root = model.root;
    this.mat = model.mat;
    this.parts = model.parts;
    this.J = model.J;
    this.tip = model.tip;
    this.face = model.face;
    this.center = model.center;
    const width = T.flying ? 0.45 : Math.min(0.33 * T.scale, 0.9);
    this.body = makeBody(position, width, (T.flying ? 0.8 : 1.85) * T.scale, T.boss ? 1.2 : 0.6);
    const seed = drawEnemySeed();
    this.yaw = seed.yaw;
    this.components = composeEnemy(
      { definition: T, model, body: this.body, seed, slot, yaw: () => this.yaw },
      {
        identity: this,
        wake: () => this.wake(),
        stun: (duration) => this.stun(duration),
        stunned: () => {
          this.state = 'stunned';
          this.t = 0;
        },
        recovered: () => {
          this.state = 'hunt';
        },
      },
      services,
    );
  }
  get hit() {
    return this.model.hit;
  }
  get hitSpheres() {
    return this.model.hitSpheres;
  }
  get hp() {
    return this.combat.hp;
  }
  set hp(value: number) {
    this.combat.hp = value;
  }
  get maxHp() {
    return this.combat.maxHp;
  }
  set maxHp(value: number) {
    this.combat.maxHp = value;
  }
  get alive() {
    return this.combat.alive;
  }
  set alive(value: boolean) {
    this.combat.alive = value;
  }
  get shieldHp() {
    return this.combat.shieldHp;
  }
  get combat() {
    return this.components.combat;
  }
  get navigation() {
    return this.components.navigation;
  }
  get clock() {
    return this.components.clock;
  }
  get hitFeedback() {
    return this.components.hitFeedback;
  }
  get disassembly() {
    return this.components.disassembly;
  }
  get telegraph() {
    return this.components.telegraph;
  }
  get perception() {
    return this.components.perception;
  }
  get bomber() {
    return this.components.bomber;
  }
  get blade() {
    return this.components.blade;
  }
  get ranged() {
    return this.components.ranged;
  }
  get rangedBehavior() {
    return this.components.rangedBehavior;
  }
  get flyer() {
    return this.components.flyer;
  }
  get boss() {
    return this.components.boss;
  }
  get aimAmt() {
    return this.rangedBehavior?.aimAmt ?? this.boss?.aimAmt ?? this.legacyAim;
  }
  set aimAmt(amount: number) {
    if (this.rangedBehavior) this.rangedBehavior.applyAim(amount);
    else if (this.boss) this.boss.applyAim(amount);
    else this.legacyAim = amount;
  }
  private wake() {
    if (this.state === 'spawn') {
      this.state = 'hunt';
      this.root.scale.setScalar(this.T.scale);
    }
  }
  stun(duration: number) {
    this.state = 'stunned';
    this.t = 0;
    this.stunDur = duration;
  }
  eye(out: Vector3) {
    return out.setFromMatrixPosition(this.parts.head.matrixWorld);
  }
  syncHit() {
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < this.hit.length; i++) {
      const marker = this.parts[this.hit[i][0]];
      if (!marker) throw Error('Enemy hit region requires a model marker');
      this.hitSpheres[i].setFromMatrixPosition(marker.matrixWorld);
    }
    this.center.setFromMatrixPosition(this.parts.torso.matrixWorld);
  }
  updateDead(dt: number) {
    this.deadT += dt;
    if (!this.rootDetached) this.disassembly?.update(dt, this.deadT);
  }
  idle(dt: number) {
    if (this.rangedBehavior) {
      this.rangedBehavior.idle(dt);
      return;
    }
    if (this.boss) {
      this.boss.idle(dt);
      return;
    }
    this.body.vel.x = damp(this.body.vel.x, 0, 6, dt);
    this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
    this.legacyAim = damp(this.legacyAim, 0, 5, dt);
  }
  think(dt: number, target: EnemyTarget) {
    const sensed = this.perception.update(dt, target);
    this.clock.remaining -= dt;
    if (this.bomber) {
      this.bomber.update(dt, sensed);
      return;
    }
    if (this.blade) {
      this.legacyAim = damp(this.legacyAim, 0, 8, dt);
      this.blade.update(dt, sensed, target);
      return;
    }
    if (this.boss) {
      this.boss.update(dt, sensed);
      return;
    }
    this.rangedBehavior?.update(dt, sensed, target.speed, this.t);
  }
  animate(dt: number, lookAt: Vector3) {
    const pose = this.components.animationFrame;
    pose.onGround = this.body.onGround;
    pose.yaw = this.yaw;
    pose.time = this.t;
    pose.fuseT = this.bomber?.fuseT ?? -1;
    pose.aimAmt = this.aimAmt;
    pose.attackT = this.blade?.attackT ?? 0;
    pose.flinch = this.hitFeedback.amount;
    pose.state = this.state;
    pose.flyState = this.flyer?.state ?? 'orbit';
    pose.bossAtk = this.boss?.attackPose ?? null;
    this.components.animation.update(pose, dt, lookAt);
  }

  get attackTime() {
    return this.blade?.attackT ?? 0;
  }
  get fuseTime() {
    return this.bomber?.fuseT ?? -1;
  }
  get bossAttacking() {
    return Boolean(this.boss?.attackPose);
  }
  get isBoss() {
    return Boolean(this.T.boss);
  }
  applyReplicaState(state: EnemyState, hp: number) {
    if (this.state === 'spawn' && state !== 'spawn') {
      this.state = state;
      this.root.scale.setScalar(this.T.scale);
    } else if (this.state !== 'spawn') this.state = state;
    this.hp = hp;
  }
  applyReplicaCombat(aim: number, attack: number, fuse: boolean, boss: boolean) {
    this.aimAmt = aim;
    this.blade?.applyAttackTime(attack);
    this.bomber?.applyFuse(fuse ? 0.5 : -1);
    this.boss?.applyAttack(boss);
  }
}
