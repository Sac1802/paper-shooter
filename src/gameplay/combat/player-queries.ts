import { Vector3 } from 'three';
export interface PlayerQueryTarget {
  readonly alive: boolean;
  readonly blocking: boolean;
  readonly center: Vector3;
  readonly forward: Vector3;
  readonly hit: readonly [string, number][];
  readonly hitSpheres: readonly Vector3[];
}
export interface PlayerRayHit<T> {
  player: T;
  point: Vector3;
  part: string;
  dist: number;
}
interface Visibility {
  hasLineOfSight(from: Vector3, to: Vector3): boolean;
}
/** Spatial player queries own their scratch values and never apply damage or inspect a runtime. */
export class PlayerQueries<T extends PlayerQueryTarget> {
  private readonly offset = new Vector3();
  private readonly guardCenter = new Vector3();
  constructor(
    private readonly targets: () => Iterable<T>,
    private readonly canHurt: (target: T) => boolean,
    private readonly world: Visibility,
  ) {}
  raycast(origin: Vector3, direction: Vector3, distance: number): PlayerRayHit<T> | null {
    let best: PlayerRayHit<T> | null = null;
    for (const target of this.targets()) {
      if (!target.alive || !this.canHurt(target)) continue;
      best = this.bodyHit(target, origin, direction, distance, best);
      if (target.blocking) best = this.guardHit(target, origin, direction, distance, best);
    }
    return best;
  }
  inArc(position: Vector3, direction: Vector3, range: number, cosHalf: number): T[] {
    const found: T[] = [];
    for (const target of this.targets()) {
      if (!target.alive || !this.canHurt(target)) continue;
      this.offset.subVectors(target.center, position);
      const distance = this.offset.length();
      if (distance > range + 0.3) continue;
      if (distance > 0.3 && this.offset.normalize().dot(direction) < cosHalf) continue;
      if (!this.world.hasLineOfSight(position, target.center)) continue;
      found.push(target);
    }
    return found;
  }
  private bodyHit(
    target: T,
    origin: Vector3,
    direction: Vector3,
    distance: number,
    best: PlayerRayHit<T> | null,
  ) {
    for (let index = 0; index < target.hit.length; index++) {
      const center = target.hitSpheres[index],
        radius = target.hit[index][1];
      this.offset.subVectors(center, origin);
      const along = this.offset.dot(direction);
      if (along < 0 || along > distance) continue;
      const squared = this.offset.lengthSq() - along * along;
      if (squared > radius * radius) continue;
      const entry = along - Math.sqrt(radius * radius - squared);
      if (entry < 0) continue;
      if (!best || entry < best.dist)
        best = {
          player: target,
          part: target.hit[index][0],
          dist: entry,
          point: new Vector3(
            origin.x + direction.x * entry,
            origin.y + direction.y * entry,
            origin.z + direction.z * entry,
          ),
        };
    }
    return best;
  }
  private guardHit(
    target: T,
    origin: Vector3,
    direction: Vector3,
    distance: number,
    best: PlayerRayHit<T> | null,
  ) {
    this.guardCenter.set(
      target.center.x + target.forward.x * 0.5,
      target.center.y + 0.3,
      target.center.z + target.forward.z * 0.5,
    );
    const radius = 0.42;
    this.offset.subVectors(this.guardCenter, origin);
    const along = this.offset.dot(direction);
    if (along > 0 && along <= distance) {
      const squared = this.offset.lengthSq() - along * along;
      if (squared <= radius * radius) {
        const entry = along - Math.sqrt(radius * radius - squared);
        if (entry >= 0 && (!best || entry < best.dist))
          best = {
            player: target,
            part: 'blade',
            dist: entry,
            point: new Vector3(
              origin.x + direction.x * entry,
              origin.y + direction.y * entry,
              origin.z + direction.z * entry,
            ),
          };
      }
    }
    return best;
  }
}
