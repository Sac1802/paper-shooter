import * as THREE from 'three';
import { clamp, lerp } from '../../engine/math.js';
import { InstancePool } from './instance-pool.js';
import type { SceneResourcePort } from '../../engine/ports.js';
import type { Particle } from './particle-contracts.js';
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion(),
  _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
export class ParticleRenderer {
  readonly drops: InstancePool;
  readonly strokes: InstancePool;
  constructor(scene: THREE.Scene, resources: SceneResourcePort) {
    this.drops = new InstancePool(scene, resources, new THREE.IcosahedronGeometry(0.5, 1), 700);
    this.strokes = new InstancePool(scene, resources, new THREE.BoxGeometry(1, 1, 1), 600);
  }
  render(particles: readonly Readonly<Particle>[]) {
    let di = 0,
      si = 0;
    for (const particle of particles) {
      const fraction = particle.life / particle.maxLife;
      if (particle.kind === 'drop') {
        if (di >= this.drops.max) continue;
        this.drop(particle, fraction, di++);
      } else if (particle.kind === 'stroke') {
        if (si >= this.strokes.max) continue;
        this.stroke(particle, fraction, si++);
      }
    }
    this.drops.mesh.count = di;
    this.strokes.mesh.count = si;
    this.drops.upload();
    this.strokes.upload();
  }
  private drop(p: Readonly<Particle>, fraction: number, index: number) {
    const size =
      p.size * (p.grow ? lerp(1, p.grow, 1 - fraction) : p.shrink ? 0.4 + 0.6 * fraction : 1);
    _s.set(size, size, size);
    _q.identity();
    this.drops.write(index, p.pos, _q, _s, p.ink, p.fill);
  }
  private stroke(p: Readonly<Particle>, fraction: number, index: number) {
    let length;
    if (p.len > 0) {
      if (!p.axis) throw new Error('A fixed-length stroke requires an axis');
      _d.copy(p.axis);
      length = p.len;
    } else {
      const velocity = p.vel;
      if (!velocity) throw new Error('A moving stroke requires a velocity vector');
      const speed = velocity.length();
      if (speed < 1e-4) {
        _d.set(0, 1, 0);
        length = p.size;
      } else {
        _d.copy(velocity).divideScalar(speed);
        length = clamp(speed * p.stretch, p.size * 2, 1.6);
      }
    }
    _q.setFromUnitVectors(_up, _d);
    const width = p.size * (p.shrink ? 0.5 + 0.5 * fraction : 1);
    _s.set(width, length, width);
    this.strokes.write(index, p.pos, _q, _s, p.ink, p.fill);
  }
  clear() {
    this.drops.reset();
    this.strokes.reset();
  }
  dispose() {
    this.drops.dispose();
    this.strokes.dispose();
  }
}
