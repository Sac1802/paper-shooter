import { Vector3 } from 'three';
import { nearestRayTarget, shotDamage } from '../../domain/ballistics.js';
import { SEE_THROUGH } from '../../engine/physics.js';
import { INK } from '../../shared/ink.js';
import type { RaycastHit } from '../../engine/ports.js';
import type { EnemyRayHit } from '../enemies/queries.js';
import type { GunImpactSpec, HitscanPorts, WeaponPlayerHit } from './impact-contracts.js';
/** Owns target precedence, hit policy and tracer outcomes; no weapon, view or application context. */
export class Hitscan<E, P> {
  private readonly muzzle = new Vector3();
  constructor(private readonly ports: HitscanPorts<E, P>) {}
  fire(
    spec: GunImpactSpec,
    origin: Vector3,
    direction: Vector3,
    readMuzzle: (out: Vector3) => void,
  ): boolean {
    const enemy = this.ports.enemies.raycast(origin, direction, 300);
    const world = this.ports.world.raycast(origin, direction, 300, SEE_THROUGH);
    const player = this.ports.players.raycast(origin, direction, 300);
    const target = nearestRayTarget(enemy, world, player);
    let end: Vector3;
    let hit = false;
    if (target === 'player' && player) {
      end = player.point;
      this.damagePlayer(spec, player, direction);
      hit = true;
    } else if (target === 'enemy' && enemy) {
      end = enemy.point;
      this.damageEnemy(spec, enemy, direction);
      hit = true;
    } else if (target === 'world' && world) {
      end = world.point;
      hit = this.impactWorld(spec, world, enemy, direction);
    } else end = origin.clone().addScaledVector(direction, 300);
    // The muzzle is sampled after impact callbacks, just as in the original weapon code.
    readMuzzle(this.muzzle);
    this.ports.feedback.tracer(this.muzzle, end, INK.BLUE, spec.tracer, 0.05);
    this.ports.feedback.shot(end);
    return hit;
  }
  private damagePlayer(spec: GunImpactSpec, hit: WeaponPlayerHit<P>, direction: Vector3) {
    const critical = hit.part === 'head';
    const [base, multiplier, falloff] = spec.pvp || [spec.damage, spec.headMul, spec.falloff];
    const damage = shotDamage(base, multiplier, falloff, hit.dist, critical);
    this.ports.players.damage(hit.player, damage, {
      point: hit.point,
      dir: direction,
      part: hit.part,
      source: spec.kind,
      crit: critical,
      dist: hit.dist,
    });
  }
  private damageEnemy(spec: GunImpactSpec, hit: EnemyRayHit<E>, direction: Vector3) {
    const critical = hit.part === 'head';
    const damage = shotDamage(spec.damage, spec.headMul, spec.falloff, hit.dist, critical);
    this.ports.enemies.damage(hit.enemy, damage, {
      point: hit.point,
      dir: direction,
      part: hit.part,
      source: spec.kind,
      crit: critical,
    });
  }
  private impactWorld(
    spec: GunImpactSpec,
    hit: RaycastHit,
    enemy: EnemyRayHit<E> | null,
    direction: Vector3,
  ): boolean {
    // A wall/enemy tie draws the wall impact without breaking a prop at that same distance.
    if (
      hit.box?.data.breakable &&
      (!enemy || hit.dist < enemy.dist) &&
      this.ports.breakableHit(hit.box.data.breakable, spec.damage, hit.point, direction)
    )
      return true;
    this.ports.feedback.bulletImpact(hit.point, hit.normal, INK.BLUE);
    if (Math.random() < 0.25) this.ports.feedback.ricochet(hit.point);
    return false;
  }
}
