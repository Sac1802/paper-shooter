import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
import type { RaycastPort, SceneResourcePort } from '../../engine/ports.js';
interface FragmentOptions {
  life?: number;
  radius?: number;
  blood?: boolean;
}
interface Fragment {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  life: number;
  radius: number;
  blood: boolean;
  rest: boolean;
  bloodT: number;
  bounces: number;
  baseScale: number;
}
interface FragmentDecals {
  splat(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    ink: number,
    size: number,
    direction: THREE.Vector3 | null,
    cluster: number,
  ): void;
}
interface FragmentParticles {
  spawn(
    kind: 'drop',
    point: THREE.Vector3,
    velocity: THREE.Vector3,
    options: { size: number; life: number; collide: 'decal'; gravity: number; decalSize: number },
  ): unknown;
}

const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _prev = new THREE.Vector3();
export class DebrisSimulation {
  readonly list: Fragment[] = [];
  gibsAlive = 0;
  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: RaycastPort,
    private readonly resources: SceneResourcePort,
    private readonly decals: FragmentDecals,
    private readonly particles: FragmentParticles,
  ) {}
  spawn(
    mesh: THREE.Object3D,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    angVel: THREE.Vector3,
    o: FragmentOptions = {},
  ) {
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.resources.track(mesh);
    const d = {
      mesh,
      vel: vel.clone(),
      ang: angVel.clone(),
      life: o.life ?? 10,
      radius: o.radius ?? 0.18,
      blood: o.blood ?? false,
      rest: false,
      bloodT: 0,
      bounces: 0,
      baseScale: mesh.scale.x,
    };
    this.list.push(d);
    if (d.blood) this.gibsAlive++;
    if (this.list.length > 70) {
      const old = this.list[0];
      this.list.shift();
      this.resources.release(old.mesh);
      if (old.blood) this.gibsAlive--;
    }
    return d;
  }
  update(dt: number) {
    // debris
    const ds = this.list;
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i];
      const m = d.mesh;
      if (!d.rest) {
        d.vel.y -= 20 * dt;
        _prev.copy(m.position);
        m.position.addScaledVector(d.vel, dt);
        _d.subVectors(m.position, _prev);
        const len = _d.length();
        if (len > 1e-6) {
          _d.divideScalar(len);
          const hit = this.world.raycast(_prev, _d, len + d.radius);
          if (hit) {
            m.position.copy(hit.point).addScaledVector(hit.normal, d.radius);
            const vn = d.vel.dot(hit.normal);
            if (vn < 0) {
              d.vel.addScaledVector(hit.normal, -1.35 * vn);
              d.vel.multiplyScalar(0.55);
              d.ang.multiplyScalar(0.5);
            }
            d.bounces++;
            if (d.blood && d.bounces <= 3)
              this.decals.splat(hit.point, hit.normal, INK.RED, rand(0.4, 0.85), null, 2);
            if (d.vel.length() < 1.0 && hit.normal.y > 0.5) {
              d.rest = true;
              d.vel.set(0, 0, 0);
            }
          }
        }
        m.rotation.x += d.ang.x * dt;
        m.rotation.y += d.ang.y * dt;
        m.rotation.z += d.ang.z * dt;
        if (d.blood && d.vel.lengthSq() > 3) {
          d.bloodT -= dt;
          if (d.bloodT <= 0) {
            d.bloodT = 0.05;
            _v.copy(d.vel)
              .multiplyScalar(0.3)
              .add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)));
            this.particles.spawn('drop', m.position, _v, {
              size: rand(0.02, 0.045),
              life: 1.5,
              collide: 'decal',
              gravity: 22,
              decalSize: 6,
            });
          }
        }
        if (m.position.y < -8) d.life = 0;
      }
      d.life -= dt;
      if (d.life < 0.6) m.scale.setScalar(Math.max(0.001, d.life / 0.6) * d.baseScale);
      if (d.life <= 0) {
        this.resources.release(m);
        if (d.blood) this.gibsAlive--;
        ds.splice(i, 1);
      }
    }
  }
  clear() {
    for (const item of this.list) this.resources.release(item.mesh);
    this.list.length = 0;
    this.gibsAlive = 0;
  }
}
