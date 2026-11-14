import * as THREE from 'three';
import { INK } from '../shared/ink.js';
import { SEE_THROUGH } from '../engine/physics.js';
import { clamp } from '../engine/math.js';
import type {
  Projectile,
  ProjectileEnemy,
  ProjectilePorts,
  ProjectileShot,
  ProjectileTarget,
  ProjectileViewPort,
} from './projectile-contracts.js';
/** Projectile lifetime/collision policy; no manager, scene or application context. */
export class Projectiles<E extends ProjectileEnemy = ProjectileEnemy> {
  private readonly offset = new THREE.Vector3();
  private readonly projection = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  readonly list: Projectile<E>[] = [];
  readonly max = 240;
  onFire: ((projectile: Projectile<E>) => void) | null = null;
  constructor(
    private readonly ports: ProjectilePorts<E>,
    private readonly view: ProjectileViewPort<E>,
  ) {}
  clear() {
    this.list.length = 0;
    this.view.clear();
  }
  fire(pos: THREE.Vector3, dir: THREE.Vector3, shot: ProjectileShot<E>) {
    const {
      speed,
      damage: dmg,
      owner,
      ink = INK.RED,
      thickness: thick = 0.045,
      blast = 0,
      id = null,
    } = shot;
    if (this.list.length >= this.max) this.list.shift();
    const p: Projectile<E> = {
      id: id ?? this.ports.allocateId(),
      pos: pos.clone(),
      prev: pos.clone(),
      vel: dir.clone().multiplyScalar(speed),
      dmg,
      owner,
      life: 4,
      deflected: false,
      ink,
      thick,
      origin: pos.clone(),
      blast,
    };
    this.list.push(p);
    if (this.onFire && id === null) this.onFire(p);
    return p;
  }
  deflectArc(
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    range: number,
    cosHalf: number,
    player: ProjectileTarget,
  ) {
    let n = 0;
    for (const p of this.list) {
      if (p.deflected) continue;
      this.offset.subVectors(p.pos, origin);
      const d = this.offset.length();
      if (d > range) continue;
      if (d > 0.01 && this.offset.divideScalar(d).dot(forward) < cosHalf) continue;
      this._deflect(p, player, false);
      n++;
    }
    return n;
  }
  _deflect(p: Projectile<E>, player: ProjectileTarget, perfect: boolean) {
    const queries = this.ports.queries;
    p.deflected = true;
    p.ink = INK.BLUE;
    p.dmg *= perfect ? 3.5 : 2.2;
    p.life = 3;
    let target;
    if (perfect && p.owner && p.owner.alive) target = p.owner;
    else
      target =
        queries.nearestVisible(player.eye, player.forward, Math.cos(0.7), 70) ||
        (p.owner && p.owner.alive ? p.owner : null);
    const speed = p.vel.length() * 1.6;
    if (target) this.direction.subVectors(target.center, p.pos).normalize();
    else this.direction.copy(player.forward);
    p.vel.copy(this.direction).multiplyScalar(speed);
    this.ports.effects.sparks(p.pos, this.direction, INK.ORANGE, 10, 9);
    this.ports.effects.strokeBurst(p.pos, INK.BLUE, 8, 4, { life: 0.2 });
  }
  _burst(p: Projectile<E>, point: THREE.Vector3) {
    const { effects, audio } = this.ports;
    effects.explosion(point, 2.5, INK.BLACK);
    audio.explosion(point);
    const P = this.ports.player();
    const d = P.center.distanceTo(point);
    if (d < 3.5 && P.alive) {
      P.takeDamage(p.dmg * (1 - d / 3.5), point);
      P.knockback(this.offset.subVectors(P.center, point).normalize(), 6);
    }
    if (this.ports.authoritative()) this.ports.blast(point, 3.5, p.dmg * 1.5, p.owner);
  }

  update(dt: number) {
    const list = this.list;
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.prev.copy(p.pos);
      if (p.blast) p.vel.y -= 9 * dt;
      p.pos.addScaledVector(p.vel, dt);
      this.direction.subVectors(p.pos, p.prev);
      const distance = this.direction.length();
      if (distance < 1e-6) {
        list[count++] = p;
        continue;
      }
      this.direction.divideScalar(distance);
      if (this.hitWorld(p, distance)) continue;
      if (!p.deflected) {
        if (this.hitPlayers(p) === 1) continue;
      } else if (this.hitEnemy(p, distance)) continue;
      list[count++] = p;
    }
    list.length = count;
    this.view.render(list);
  }
  private hitWorld(p: Projectile<E>, distance: number) {
    const hit = this.ports.world.raycast(p.prev, this.direction, distance, SEE_THROUGH);
    if (!hit) return false;
    if (p.blast) this._burst(p, hit.point);
    else {
      this.ports.effects.bulletImpact(hit.point, hit.normal, p.ink);
      if (Math.random() < 0.5) this.ports.audio.bulletImpact(hit.point);
    }
    return true;
  }
  /** 0 misses, 1 consumes, 2 reflects and retains the projectile. */
  private hitPlayers(p: Projectile<E>): 0 | 1 | 2 {
    for (const player of this.ports.targets()) {
      if (!player.alive) continue;
      const radius = Math.max(p.blast ? 0.9 : 0.5, player.isLocal ? player.blockRadius : 0);
      if (!this._segHitsPlayer(p.prev, p.pos, player, radius)) continue;
      if (!player.isLocal) {
        if (this._segHitsPlayer(p.prev, p.pos, player, p.blast ? 0.9 : 0.5)) return 1;
        continue;
      }
      const result = this.hitLocalPlayer(p, player);
      if (result) return result;
    }
    return 0;
  }
  private hitLocalPlayer(p: Projectile<E>, player: ProjectileTarget): 0 | 1 | 2 {
    const deflection = player.tryDeflect(p);
    if (deflection) {
      if (deflection.ret) {
        this._deflect(p, player, deflection.perfect);
        return 2;
      }
      p.deflected = true;
      this.ports.effects.strokeBurst(p.pos, INK.RED, 5, 6, { life: 0.18, size: 0.03 });
      return 1;
    }
    if (!this._segHitsPlayer(p.prev, p.pos, player, p.blast ? 0.9 : 0.5)) return 0;
    if (p.blast) this._burst(p, p.pos);
    else player.takeDamage(p.dmg, p.origin);
    return 1;
  }
  private hitEnemy(p: Projectile<E>, distance: number) {
    const hit = this.ports.queries.raycast(p.prev, this.direction, distance);
    if (!hit) return false;
    if (p.blast) this._burst(p, hit.point);
    else
      this.ports.damage(hit.enemy, p.dmg, {
        point: hit.point,
        dir: this.direction.clone(),
        part: hit.part,
        source: 'deflect',
        crit: hit.part === 'head',
      });
    return true;
  }

  _segHitsPlayer(
    a: THREE.Vector3,
    b: THREE.Vector3,
    P: Pick<ProjectileTarget, 'center' | 'eye'>,
    r = 0.5,
  ) {
    const cy = P.center;
    this.offset.subVectors(b, a);
    const l2 = this.offset.lengthSq();
    if (l2 < 1e-8) return false;
    for (const c of [cy, P.eye]) {
      const t = clamp(this.projection.subVectors(c, a).dot(this.offset) / l2, 0, 1);
      this.closest.copy(a).addScaledVector(this.offset, t);
      if (this.closest.distanceToSquared(c) < r * r) return true;
    }
    this.closest.copy(cy);
    this.closest.y -= 0.55;
    const t = clamp(this.projection.subVectors(this.closest, a).dot(this.offset) / l2, 0, 1);
    this.projection.copy(a).addScaledVector(this.offset, t);
    return this.projection.distanceToSquared(this.closest) < (r - 0.05) * (r - 0.05);
  }
}
