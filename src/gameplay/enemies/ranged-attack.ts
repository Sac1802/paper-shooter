import { Vector3, type Object3D } from 'three';
import { rand, clamp } from '../../engine/math.js';
import { INK } from '../../shared/ink.js';
import type {
  EnemyDefinition,
  RangedEnemyDefinition,
  BurstEnemyDefinition,
  SniperEnemyDefinition,
} from '../../domain/enemy-definitions.js';
export interface EnemyAttackClock {
  remaining: number;
}
export interface EnemyBullet {
  speed: number;
  damage: number;
  ink: number;
  thickness: number;
}
export interface RangedAttackPorts {
  emit(position: Vector3, direction: Vector3, bullet: EnemyBullet): void;
  damageModifier: () => number;
  laser: { show(from: Vector3, to: Vector3, charge: number): void; hide(): void };
  audio: {
    sniperAim(position: Vector3): void;
    sniperShot(position: Vector3): void;
    enemyShot(position: Vector3): void;
    shotgun(position: Vector3): void;
  };
  effects: {
    strokeBurst(
      position: Vector3,
      ink: number,
      count: number,
      speed: number,
      options: { life: number; size: number },
    ): void;
  };
  center: Vector3;
}
/** Owns burst/aim progress; the behavior's cooldown and numeric target motion are explicit inputs. */
export class RangedAttack {
  private shotsLeft = 0;
  private burstTime = 0;
  private aimTime = 0;
  private aimPoint: Vector3 | null = null;
  private aimWarned = false;
  private readonly muzzle = new Vector3();
  private readonly direction = new Vector3();
  constructor(
    private readonly definition: RangedEnemyDefinition,
    private readonly attachment: Object3D,
    private readonly clock: EnemyAttackClock,
    private readonly ports: RangedAttackPorts,
  ) {}
  get burstLeft() {
    return this.shotsLeft;
  }
  get aimT() {
    return this.aimTime;
  }
  interrupt() {
    this.shotsLeft = 0;
    this.aimTime = 0;
    this.aimPoint = null;
    this.ports.laser.hide();
  }
  shoot(dt: number, target: Vector3, targetSpeed: number) {
    const T = this.definition;
    this.muzzle.setFromMatrixPosition(this.attachment.matrixWorld);
    if (T.weapon === 'sniper') {
      this.sniper(dt, target, targetSpeed, T);
      return;
    }
    if (this.shotsLeft > 0 && T.weapon !== 'shotgun') {
      this.burst(dt, target, targetSpeed, T);
      return;
    }
    if (this.clock.remaining > 0) return;
    if (T.weapon === 'shotgun') {
      for (let i = 0; i < T.pellets; i++)
        this.fireOne(target, T.pspeed * rand(0.85, 1.1), 0.05, targetSpeed);
      this.ports.audio.shotgun(this.ports.center);
      this.clock.remaining = rand(T.cool[0], T.cool[1]);
      this.ports.effects.strokeBurst(this.muzzle, INK.ORANGE, 8, 5, { life: 0.1, size: 0.04 });
    } else {
      this.shotsLeft = T.burst;
      this.burstTime = 0;
    }
  }
  private sniper(dt: number, target: Vector3, targetSpeed: number, T: SniperEnemyDefinition) {
    if (this.clock.remaining > 0) {
      this.ports.laser.hide();
      return;
    }
    this.aimTime += dt;
    let aim = this.aimPoint;
    if (!aim) {
      aim = target.clone();
      this.aimPoint = aim;
    } else aim.lerp(target, 1 - Math.exp(-2.6 * dt));
    this.ports.laser.show(this.muzzle, aim, clamp(this.aimTime / T.aimTime, 0, 1));
    if (this.aimTime > T.aimTime * 0.5 && !this.aimWarned) {
      this.aimWarned = true;
      this.ports.audio.sniperAim(this.ports.center);
    }
    if (this.aimTime < T.aimTime) return;
    this.aimTime = 0;
    this.aimWarned = false;
    this.clock.remaining = rand(T.cool[0], T.cool[1]);
    this.fireOne(aim, T.pspeed, 0.07, targetSpeed);
    this.ports.audio.sniperShot(this.ports.center);
    this.ports.laser.hide();
    this.aimPoint = null;
  }
  private burst(dt: number, target: Vector3, targetSpeed: number, T: BurstEnemyDefinition) {
    this.burstTime -= dt;
    if (this.burstTime > 0) return;
    this.burstTime = T.burstInt;
    this.shotsLeft--;
    this.fireOne(target, T.pspeed, 0.045, targetSpeed);
    this.ports.audio.enemyShot(this.ports.center);
    if (this.shotsLeft === 0) this.clock.remaining = rand(T.cool[0], T.cool[1]);
  }
  private fireOne(target: Vector3, speed: number, thickness: number, targetSpeed: number) {
    const T = this.definition,
      direction = this.direction;
    direction.subVectors(target, this.muzzle);
    direction.y += rand(-0.2, 0.3);
    direction.normalize();
    const spread = T.spread * (1 + targetSpeed * 0.06);
    direction.x += rand(-spread, spread);
    direction.y += rand(-spread, spread);
    direction.z += rand(-spread, spread);
    direction.normalize();
    this.ports.emit(this.muzzle, direction, {
      speed,
      damage: T.dmg * this.ports.damageModifier(),
      ink: INK.RED,
      thickness,
    });
    this.ports.effects.strokeBurst(this.muzzle, INK.ORANGE, 4, 4, { life: 0.07, size: 0.03 });
  }
}
export function createRangedAttack(
  definition: EnemyDefinition,
  attachment: Object3D,
  clock: EnemyAttackClock,
  ports: RangedAttackPorts,
): RangedAttack | null {
  if (
    definition.weapon === 'rifle' ||
    definition.weapon === 'pistol' ||
    definition.weapon === 'shotgun' ||
    definition.weapon === 'sniper'
  )
    return new RangedAttack(definition, attachment, clock, ports);
  return null;
}
