import type { Vector3 } from 'three';
import type { RaycastPort } from '../../engine/ports.js';
import type { EnemyRayHit } from '../enemies/queries.js';
import type { Falloff, GunKind } from '../../domain/weapons.js';
export interface WeaponImpact {
  point: Vector3;
  dir: Vector3;
  part: string;
  source: string;
  crit: boolean;
  dist?: number;
  slashDir?: number;
}
export interface WeaponPlayerHit<P> {
  player: P;
  point: Vector3;
  part: string;
  dist: number;
}
export interface GunImpactSpec {
  kind: GunKind;
  damage: number;
  headMul: number;
  falloff: Falloff | null;
  pvp?: [number, number, Falloff | null];
  tracer: number;
}
export interface HitscanPorts<E, P> {
  world: RaycastPort;
  enemies: {
    raycast(origin: Vector3, direction: Vector3, distance: number): EnemyRayHit<E> | null;
    damage(enemy: E, amount: number, impact: WeaponImpact): void;
  };
  players: {
    raycast(origin: Vector3, direction: Vector3, distance: number): WeaponPlayerHit<P> | null;
    damage(player: P, amount: number, impact: WeaponImpact): void;
  };
  breakableHit(
    reference: { id: number },
    amount: number,
    point: Vector3,
    direction: Vector3,
  ): boolean;
  feedback: {
    tracer(from: Vector3, to: Vector3, ink: number, thickness: number, life: number): void;
    bulletImpact(point: Vector3, normal: Vector3, ink: number): void;
    ricochet(point: Vector3): void;
    shot(point: Vector3): void;
  };
}
export interface MeleeImpactPorts<E, P> {
  enemies: {
    inArc(
      position: Vector3,
      direction: Vector3,
      range: number,
      cosHalf: number,
    ): readonly { enemy: E }[];
    damage(enemy: E, amount: number, impact: WeaponImpact): void;
  };
  players: {
    inArc(position: Vector3, direction: Vector3, range: number, cosHalf: number): readonly P[];
    damage(player: P, amount: number, impact: WeaponImpact): void;
  };
  ropes: { cut(position: Vector3, direction: Vector3, range: number): boolean };
  props: {
    inArc(
      position: Vector3,
      direction: Vector3,
      range: number,
      cosHalf: number,
    ): readonly { id: number; pos: Vector3 }[];
    damage(reference: { id: number }, amount: number, point: Vector3, direction: Vector3): void;
  };
}
