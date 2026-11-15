import type { Vector3 } from 'three';
import { rand } from '../../engine/math.js';
import type { MeleeImpactPorts } from './impact-contracts.js';
interface CenteredTarget {
  center: Vector3;
}
/** Owns ordered blade damage and rope/prop interaction through query/command capabilities. */
export class MeleeImpacts<E extends CenteredTarget, P extends CenteredTarget> {
  constructor(private readonly ports: MeleeImpactPorts<E, P>) {}
  strike(
    eye: Vector3,
    forward: Vector3,
    direction: Vector3,
    slash: number,
    damage: number,
  ): boolean {
    let any = false;
    for (const hit of this.ports.enemies.inArc(eye, forward, 3.0, Math.cos(0.95))) {
      any = true;
      const point = hit.enemy.center.clone();
      point.y += rand(-0.2, 0.4);
      this.ports.enemies.damage(hit.enemy, damage, {
        point,
        dir: direction.clone(),
        part: 'torso',
        source: 'katana',
        crit: false,
        slashDir: slash,
      });
    }
    for (const target of this.ports.players.inArc(eye, forward, 3.0, Math.cos(0.95))) {
      any = true;
      this.ports.players.damage(target, 55, {
        point: target.center.clone(),
        dir: direction.clone(),
        part: 'torso',
        source: 'katana',
        crit: false,
      });
    }
    if (this.ports.ropes.cut(eye, forward, 3.4)) any = true;
    for (const prop of this.ports.props.inArc(eye, forward, 3.2, Math.cos(1.0))) {
      any = true;
      this.ports.props.damage(prop, damage, prop.pos.clone(), direction.clone());
    }
    return any;
  }
}
