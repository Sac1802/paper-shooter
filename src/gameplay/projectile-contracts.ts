import type { Vector3 } from 'three';
import type { RaycastPort } from '../engine/ports.js';
import type { EnemyRayHit } from './enemies/queries.js';
export interface ProjectileEnemy {
  id: number;
  alive: boolean;
  center: Vector3;
}
export interface Projectile<E extends ProjectileEnemy = ProjectileEnemy> {
  id: number;
  pos: Vector3;
  prev: Vector3;
  vel: Vector3;
  dmg: number;
  owner: E | null;
  life: number;
  deflected: boolean;
  ink: number;
  thick: number;
  origin: Vector3;
  blast: number;
}
export interface ProjectileTarget {
  alive: boolean;
  isLocal: boolean;
  center: Vector3;
  eye: Vector3;
  forward: Vector3;
  blockRadius: number;
  takeDamage(amount: number, from: Vector3): void;
  knockback(direction: Vector3, amount: number): void;
  tryDeflect(projectile: {
    pos: Vector3;
    vel: Vector3;
  }): false | { ret: boolean; perfect: boolean };
}
export interface ProjectileHit {
  point: Vector3;
  dir: Vector3;
  part: string;
  source: 'deflect';
  crit: boolean;
}
export interface ProjectileShot<E extends ProjectileEnemy> {
  speed: number;
  damage: number;
  owner: E | null;
  ink?: number;
  thickness?: number;
  blast?: number;
  id?: number | null;
}
export interface ProjectileEffects {
  sparks(point: Vector3, direction: Vector3, ink: number, count: number, speed: number): void;
  strokeBurst(
    point: Vector3,
    ink: number,
    count: number,
    speed: number,
    options: { life: number; size?: number },
  ): void;
  explosion(point: Vector3, radius: number, ink: number): void;
  bulletImpact(point: Vector3, normal: Vector3, ink: number): void;
}
export interface ProjectilePorts<E extends ProjectileEnemy> {
  world: RaycastPort;
  player: () => ProjectileTarget;
  targets: () => readonly ProjectileTarget[];
  allocateId: () => number;
  authoritative: () => boolean;
  queries: {
    nearestVisible(from: Vector3, forward: Vector3, cosHalf: number, maxDistance: number): E | null;
    raycast(from: Vector3, direction: Vector3, maxDistance: number): EnemyRayHit<E> | null;
  };
  damage(enemy: E, amount: number, hit: ProjectileHit): void;
  blast(point: Vector3, radius: number, damage: number, except: E | null): void;
  effects: ProjectileEffects;
  audio: { explosion(point: Vector3): void; bulletImpact(point: Vector3): void };
}
export interface ProjectileViewPort<E extends ProjectileEnemy> {
  render(projectiles: readonly Projectile<E>[]): void;
  clear(): void;
}
