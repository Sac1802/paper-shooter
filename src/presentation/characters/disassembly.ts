import { Vector3, type Object3D } from 'three';
import { rand, randInt } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
import type { EnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyDeathDecision, EnemyDeathImpact } from '../../domain/enemy-death.js';
import type { WalkingRig } from '../models/enemy.js';
import { DeathPose } from './death-pose.js';
import type { DisassemblyPose, DisassemblyPorts } from './disassembly-contracts.js';
/** Owns fragment selection/transfer and corpse pose; health, damage authority and scoring stay outside. */
export class EnemyDisassembly {
  private readonly impulse = new Vector3();
  private readonly extra = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private deathPose: DeathPose | null = null;
  constructor(
    private readonly definition: Pick<EnemyDefinition, 'boss' | 'ink' | 'scale'>,
    private readonly rig: WalkingRig,
    private readonly pose: DisassemblyPose,
    private readonly ports: DisassemblyPorts,
  ) {}
  perform(impact: EnemyDeathImpact, direction: Vector3, decision: EnemyDeathDecision) {
    const rig = this.rig,
      ink = this.definition.ink === INK.BLACK ? INK.BLACK : INK.RED;
    if (decision.sever) {
      this.ports.audio.gib(this.pose.center);
      this.sever(impact, direction, decision, ink);
    }
    const pivot = rig.J.hips.parent;
    if (!pivot) throw new Error('Corpse hips require their root attachment');
    this.deathPose = new DeathPose(rig.root, pivot, {
      axis: Math.random() < 0.5 ? 'x' : 'z',
      sign: direction.z > 0 || Math.random() < 0.5 ? 1 : -1,
    });
    this.ports.effects.bloodPool(
      this.pose.position,
      rand(1.1, 1.8) * (this.definition.boss ? 2.5 : 1),
      ink,
    );
    this.ports.effects.blood(this.pose.center, direction, 1.2, { ink });
    if (Math.random() < 0.6 && rig.J.gun.parent)
      this.detach(rig.J.gun, this.extra.set(rand(-2, 2), 2, rand(-2, 2)), 0.08, direction);
    if (rig.J.shieldG && this.breakShield()) this.ports.shieldBroken();
  }
  breakShield() {
    const shield = this.rig.J.shieldG;
    if (!shield?.parent) return false;
    shield.updateWorldMatrix(true, false);
    this.ports.scene.attach(shield);
    this.ports.effects.debris(
      shield,
      shield.position,
      new Vector3(rand(-3, 3), 4, rand(-3, 3)),
      new Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      { radius: 0.4, blood: false, life: 8 },
    );
    this.rig.hit = this.rig.hit.filter(([part]) => part !== 'shield');
    this.rig.hitSpheres = this.rig.hit.map(() => new Vector3());
    this.rig.J.shieldG = null;
    this.ports.audio.shieldHit(this.pose.center);
    return true;
  }
  update(dt: number, age: number) {
    this.deathPose?.update(dt, age, this.definition.scale, this.pose.yaw());
  }
  private sever(
    impact: EnemyDeathImpact,
    direction: Vector3,
    decision: EnemyDeathDecision,
    ink: number,
  ) {
    const J = this.rig.J;
    if (
      impact.crit ||
      ((impact.source === 'katana' || impact.source === 'focus') && Math.random() < 0.35)
    ) {
      this.detach(J.headG, this.extra.set(rand(-2, 2), 3, rand(-2, 2)), 0.25, direction);
      this.ports.effects.fountain(
        this.rig.parts.torso.getWorldPosition(new Vector3()).add(this.extra.set(0, 0.35, 0)),
        this.up,
        0.9,
        ink,
      );
    }
    if (impact.source === 'katana' || impact.source === 'focus') this.slice(direction, ink);
    else if (impact.source === 'deflect' || impact.source === 'blast' || decision.extreme)
      this.fragment(direction);
  }
  private slice(direction: Vector3, ink: number) {
    const chance = Math.random(),
      J = this.rig.J;
    if (chance < 0.4)
      this.detach(J.armR, this.extra.set(rand(-3, 3), 2, rand(-3, 3)), 0.12, direction);
    else if (chance < 0.7)
      this.detach(J.armL, this.extra.set(rand(-3, 3), 2, rand(-3, 3)), 0.12, direction);
    else {
      this.detach(J.torso, this.extra.set(rand(-2, 2), 2, rand(-2, 2)), 0.3, direction);
      this.ports.effects.fountain(
        (this.rig.parts.hips ?? J.hips).getWorldPosition(new Vector3()),
        this.up,
        0.7,
        ink,
      );
    }
  }
  private fragment(direction: Vector3) {
    const J = this.rig.J,
      limbs = [J.armL, J.armR, J.legL, J.legR, J.torso],
      count = this.definition.boss ? 5 : randInt(1, 2);
    for (let i = 0; i < count && limbs.length; i++) {
      const limb = limbs.splice(randInt(0, limbs.length - 1), 1)[0];
      this.detach(limb, this.extra.set(rand(-3, 3), 2, rand(-3, 3)), 0.15, direction);
    }
  }
  private detach(object: Object3D, extraVelocity: Vector3, radius: number, direction: Vector3) {
    if (!object.parent) return;
    object.updateWorldMatrix(true, false);
    this.ports.scene.attach(object);
    this.impulse.copy(direction).multiplyScalar(rand(3, 7)).add(extraVelocity);
    this.impulse.y += rand(2, 5);
    this.ports.effects.debris(
      object,
      object.position,
      this.impulse,
      new Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
      { radius, blood: true, life: rand(7, 10) },
    );
  }
}
