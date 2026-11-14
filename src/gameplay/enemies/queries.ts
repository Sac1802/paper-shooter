import * as THREE from 'three';
import { SEE_THROUGH } from '../../engine/physics.js';
export interface TargetPose {
  alive: boolean;
  body: { pos: THREE.Vector3 };
  center: THREE.Vector3;
}
export interface SpatialEnemy {
  alive: boolean;
  center: THREE.Vector3;
  body: { pos: THREE.Vector3 };
  T: { scale: number; boss?: boolean };
  hit: [string, number][];
  hitSpheres: THREE.Vector3[];
}
export interface EnemyRayHit<E> {
  enemy: E;
  part: string;
  dist: number;
  point: THREE.Vector3;
}
export interface VisibilityPort {
  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3, ignore: typeof SEE_THROUGH): boolean;
}
/** Spatial reads and target selection, independent of combat, models and the enemy manager. */
export class EnemyQueries<E extends SpatialEnemy, Target extends TargetPose> {
  private readonly scratch = new THREE.Vector3();
  constructor(
    private readonly entities: () => readonly E[],
    private readonly targets: () => readonly Target[],
    private readonly world: VisibilityPort,
  ) {}
  pickTarget(e: E & { target?: Target | null; retargetT?: number }, dt: number): Target | null {
    e.retargetT = (e.retargetT ?? 0) - dt;
    if (e.target && e.target.alive && e.retargetT > 0) return e.target;
    e.retargetT = 0.5;
    let best = null,
      bd = Infinity;
    for (const t of this.targets()) {
      if (!t.alive) continue;
      const d = t.body.pos.distanceToSquared(e.body.pos);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    e.target = best;
    return best;
  }
  nearestTarget(pos: THREE.Vector3): Target | null {
    let best = null,
      bd = Infinity;
    for (const t of this.targets()) {
      if (!t.alive) continue;
      const d = t.body.pos.distanceToSquared(pos);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }
  nearestVisible(
    from: THREE.Vector3,
    forward: THREE.Vector3,
    cosHalf: number,
    maxDist: number,
  ): E | null {
    let best = null,
      bestD = maxDist;
    for (const e of this.entities()) {
      if (!e.alive) continue;
      this.scratch.subVectors(e.center, from);
      const d = this.scratch.length();
      if (d > bestD || d < 0.01) continue;
      if (this.scratch.divideScalar(d).dot(forward) < cosHalf) continue;
      if (!this.world.hasLineOfSight(from, e.center, SEE_THROUGH)) continue;
      best = e;
      bestD = d;
    }
    return best;
  }
  raycast(
    o: THREE.Vector3,
    d: THREE.Vector3,
    maxDist: number,
    ignore: E | null = null,
  ): EnemyRayHit<E> | null {
    let best = null;
    for (const e of this.entities()) {
      if (!e.alive || e === ignore) continue;
      for (let i = 0; i < e.hit.length; i++) {
        const c = e.hitSpheres[i],
          r = e.hit[i][1] * e.T.scale;
        this.scratch.subVectors(c, o);
        const tca = this.scratch.dot(d);
        if (tca < 0 || tca > maxDist) continue;
        const d2 = this.scratch.lengthSq() - tca * tca;
        if (d2 > r * r) continue;
        const t = tca - Math.sqrt(r * r - d2);
        if (t < 0) continue;
        if (!best || t < best.dist)
          best = {
            enemy: e,
            part: e.hit[i][0],
            dist: t,
            point: new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t),
          };
      }
    }
    return best;
  }
  inArc(pos: THREE.Vector3, dir: THREE.Vector3, range: number, cosHalf: number) {
    const out = [];
    for (const e of this.entities()) {
      if (!e.alive) continue;
      this.scratch.subVectors(e.center, pos);
      const d = this.scratch.length() - (e.T.boss ? 1.2 : 0);
      if (d > range + 0.3) continue;
      if (d > 0.3 && this.scratch.normalize().dot(dir) < cosHalf) continue;
      out.push({ enemy: e, dist: d });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }
}
