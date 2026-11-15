import type { Scene, Vector3 } from 'three';
import type { RaycastPort, SceneResourcePort } from '../engine/ports.js';
import type { StrokeOptions } from './effects/particle-contracts.js';
import { SceneResources } from '../engine/resources.js';
import { Decals } from './effects/decals.js';
import { ParticleRenderer } from './effects/particle-renderer.js';
import { ParticleSimulation } from './effects/particles.js';
import { DebrisSimulation } from './effects/debris.js';
import * as recipes from './effects/particle-recipes.js';
import * as blasts from './effects/blast-recipes.js';
import { INK } from '../shared/ink.js';
import { rand, damp } from '../engine/math.js';
export class Effects {
  private readonly renderer: ParticleRenderer;
  private readonly decals: Decals;
  private readonly simulation: ParticleSimulation;
  private readonly fragments: DebrisSimulation;
  shakeAmt: number;
  private disposed: boolean;
  constructor(
    scene: Scene,
    world: RaycastPort,
    resources: SceneResourcePort = new SceneResources(),
  ) {
    this.renderer = new ParticleRenderer(scene, resources);
    this.decals = new Decals(scene, world, resources);
    this.simulation = new ParticleSimulation(world, this.decals);
    this.fragments = new DebrisSimulation(scene, world, resources, this.decals, this.simulation);
    this.shakeAmt = 0;
    this.disposed = false;
  }
  get particles() {
    return this.simulation.list;
  }
  get debrisList() {
    return this.fragments.list;
  }
  get gibsAlive() {
    return this.fragments.gibsAlive;
  }
  sampleShake(dt: number) {
    const amount = this.shakeAmt;
    this.shakeAmt = damp(amount, 0, 7, dt);
    return amount;
  }
  clear() {
    this.simulation.clear();
    this.decals.clear();
    this.fragments.clear();
    this.renderer.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.decals.dispose();
    this.renderer.dispose();
  }
  update(dt: number) {
    this.simulation.update(dt);
    this.decals.update(dt);
    this.fragments.update(dt);
    this.renderer.render(this.simulation.list);
  }
  particle(...args: Parameters<ParticleSimulation['spawn']>) {
    return this.simulation.spawn(...args);
  }
  debris(...args: Parameters<DebrisSimulation['spawn']>) {
    return this.fragments.spawn(...args);
  }
  decal(
    point: Vector3,
    normal: Vector3,
    ink = INK.RED,
    size = 0.3,
    kind: 'splat' | 'hole' = 'splat',
    dir: Vector3 | null = null,
    stretch = 1,
  ) {
    return this.decals.decal(point, normal, ink, size, kind, dir, stretch);
  }
  splat(
    point: Vector3,
    normal: Vector3,
    ink = INK.RED,
    size = 0.5,
    dir: Vector3 | null = null,
    cluster = 3,
  ) {
    return this.decals.splat(point, normal, ink, size, dir, cluster);
  }
  bloodPool(pos: Vector3, size = 1.3, ink = INK.RED) {
    return this.decals.bloodPool(pos, size, ink);
  }
  sparks(point: Vector3, normal: Vector3, ink = INK.BLUE, n = 6, speed = 7) {
    return recipes.sparks(this.simulation, point, normal, ink, n, speed);
  }
  strokeBurst(pos: Vector3, ink: number, n = 16, speed = 6, opts: StrokeOptions = {}) {
    return recipes.strokeBurst(this.simulation, pos, ink, n, speed, opts);
  }
  tracer(from: Vector3, to: Vector3, ink = INK.BLUE, thick = 0.022, life = 0.06) {
    return recipes.tracer(this.simulation, from, to, ink, thick, life);
  }
  blood(pos: Vector3, dir: Vector3, amount = 1, opts: { ink?: number } = {}) {
    return recipes.blood(this.simulation, pos, dir, amount, opts);
  }
  drip(pos: Vector3, amount = 1) {
    return recipes.drip(this.simulation, pos, amount);
  }
  fountain(pos: Vector3, dir: Vector3, dur = 0.8, ink = INK.RED) {
    return recipes.fountain(this.simulation, pos, dir, dur, ink);
  }
  shell(pos: Vector3, vel: Vector3, ink = INK.ORANGE, size = 0.02) {
    return recipes.shell(this.simulation, pos, vel, ink, size);
  }
  smoke(pos: Vector3, dir: Vector3, n = 3) {
    return recipes.smoke(this.simulation, pos, dir, n);
  }
  boom(pos: Vector3, radius = 5) {
    this.shakeAmt += blasts.boom(this.simulation, this.decals, pos, radius);
  }
  explosion(pos: Vector3, radius = 4, ink = INK.BLACK) {
    this.shakeAmt += blasts.explosion(this.simulation, this.decals, pos, radius, ink);
  }
  bulletImpact(point: Vector3, normal: Vector3, ink = INK.BLUE) {
    this.decal(point, normal, ink, rand(0.06, 0.1), 'hole');
    this.sparks(point, normal, ink, 5);
  }
}
