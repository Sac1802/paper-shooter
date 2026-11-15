import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
import { SEE_THROUGH } from '../../engine/physics.js';
import type { RaycastPort } from '../../engine/ports.js';
import type {
  Particle,
  ParticleKind,
  ParticleOptions,
  SplatSurface,
} from './particle-contracts.js';
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _prev = new THREE.Vector3();
export class ParticleSimulation {
  readonly list: Particle[] = [];
  constructor(
    private readonly world: RaycastPort,
    private readonly decals: SplatSurface,
  ) {}
  spawn(
    kind: ParticleKind,
    pos: THREE.Vector3,
    vel: THREE.Vector3 | null,
    o: ParticleOptions = {},
  ): Particle {
    const p: Particle = {
      kind,
      pos: pos.clone(),
      vel: vel ? vel.clone() : null,
      life: o.life ?? 1,
      maxLife: o.life ?? 1,
      size: o.size ?? 0.05,
      ink: o.ink ?? INK.RED,
      fill: o.fill ?? true,
      gravity: o.gravity ?? 20,
      drag: o.drag ?? 0,
      collide: o.collide ?? null,
      stretch: o.stretch ?? 0.03,
      len: o.len ?? 0,
      axis: o.axis ?? null,
      decalSize: o.decalSize ?? 3,
      shrink: o.shrink ?? true,
      rate: o.rate ?? 0,
      acc: 0,
      grow: o.grow ?? 0,
    };
    this.list.push(p);
    return p;
  }
  update(dt: number) {
    const particles = this.list;
    let count = 0;
    // Emitters append into this same list; appended children retain their original same-frame step.
    for (let index = 0; index < particles.length; index++) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) continue;
      if (particle.kind === 'emitter') this.emit(particle, dt);
      else if (!this.move(particle, dt)) continue;
      particles[count++] = particle;
    }
    particles.length = count;
  }
  private emit(particle: Particle, dt: number) {
    particle.acc += dt * particle.rate;
    while (particle.acc >= 1) {
      particle.acc -= 1;
      const direction = particle.vel;
      if (!direction) throw new Error('An emitter requires a direction vector');
      _v.copy(direction)
        .multiplyScalar(rand(2, 5))
        .add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(1.2));
      this.spawn('drop', particle.pos, _v, {
        size: rand(0.02, 0.05),
        life: rand(1, 2),
        ink: particle.ink,
        collide: 'decal',
        gravity: 22,
        decalSize: 6,
      });
    }
  }
  private move(particle: Particle, dt: number) {
    const velocity = particle.vel;
    if (!velocity) return true;
    _prev.copy(particle.pos);
    velocity.y -= particle.gravity * dt;
    if (particle.drag) velocity.multiplyScalar(Math.max(0, 1 - particle.drag * dt));
    particle.pos.addScaledVector(velocity, dt);
    if (particle.collide && this.collided(particle)) return false;
    if (particle.pos.y < -10) return false;
    return true;
  }
  private collided(particle: Particle) {
    _d.subVectors(particle.pos, _prev);
    const length = _d.length();
    if (length > 1e-5) {
      _d.divideScalar(length);
      const hit = this.world.raycast(_prev, _d, length + particle.size * 0.5, SEE_THROUGH);
      if (!hit) return false;
      if (particle.collide === 'decal') {
        this.decals.splat(
          hit.point,
          hit.normal,
          particle.ink,
          particle.size * particle.decalSize * 0.75,
          _d,
          particle.size > 0.035 ? 2 : 1,
        );
      }
      return true;
    }
    return false;
  }

  clear() {
    this.list.length = 0;
  }
}
