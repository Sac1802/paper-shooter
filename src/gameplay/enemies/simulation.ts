import { Vector3, type Object3D } from 'three';
import type { Body } from '../../engine/physics.js';
import { clamp, angleLerp } from '../../engine/math.js';
import type { EnemyState } from '../../domain/enemies.js';
import type { EnemyImpact } from '../../domain/enemy-impact.js';
import type { EnemyTarget } from './actor-contracts.js';
export interface EnemyMotionWorld {
  moveBody(body: Body, dt: number): void;
  overlapsBody(body: Body): boolean;
}
export interface SimulatedEnemy {
  t: number;
  alive: boolean;
  state: EnemyState;
  stunDur: number;
  yaw: number;
  body: Body;
  T: { scale: number; flying?: boolean };
  root: Pick<Object3D, 'position' | 'rotation' | 'scale'>;
  navigation: { heading: number };
  hitFeedback: { update(dt: number): void };
  telegraph: { hide(): void };
  flyer: { update(dt: number, target: EnemyTarget, age: number): void } | null;
  updateDead(dt: number): void;
  think(dt: number, target: EnemyTarget): void;
  idle(dt: number): void;
  animate(dt: number, target: Vector3): void;
  syncHit(): void;
}
export interface EnemySimulationPorts<E> {
  target(enemy: E, dt: number): EnemyTarget;
  kill(enemy: E, impact: EnemyImpact): void;
}
/** Owns host frame phases and body separation, preserving pose-before-player-separation ordering. */
export class EnemySimulation<E extends SimulatedEnemy> {
  private separationTime = 0;
  private readonly up = new Vector3(0, 1, 0);
  constructor(
    private readonly population: () => readonly E[],
    private readonly world: EnemyMotionWorld,
    private readonly ports: EnemySimulationPorts<E>,
  ) {}
  update(dt: number) {
    for (const enemy of this.population()) {
      enemy.t += dt;
      if (!enemy.alive) {
        enemy.updateDead(dt);
        continue;
      }
      const target = this.ports.target(enemy, dt);
      enemy.hitFeedback.update(dt);
      if (enemy.state === 'spawn') {
        this.spawn(enemy);
        continue;
      }
      this.move(enemy, dt, target);
      if (enemy.body.pos.y < -6) {
        this.ports.kill(enemy, { source: 'fall', dir: this.up.clone() });
        continue;
      }
      this.present(enemy, dt, target);
    }
    this.separate(dt);
  }
  private spawn(enemy: E) {
    const progress = clamp(enemy.t / 0.6, 0, 1);
    enemy.root.scale.setScalar(
      Math.max(
        0.001,
        progress * enemy.T.scale * (1 + Math.sin(enemy.t * 60) * 0.12 * (1 - progress)),
      ),
    );
    enemy.root.position.copy(enemy.body.pos);
    enemy.root.rotation.y = enemy.yaw;
    enemy.syncHit();
    if (enemy.t >= 0.6) {
      enemy.state = 'hunt';
      enemy.root.scale.setScalar(enemy.T.scale);
    }
  }
  private move(enemy: E, dt: number, target: EnemyTarget) {
    if (enemy.state === 'stunned') enemy.telegraph.hide();
    if (enemy.T.flying) enemy.flyer?.update(dt, target, enemy.t);
    else {
      if (enemy.state === 'stunned') {
        if (enemy.t > enemy.stunDur) enemy.state = 'hunt';
      } else if (target.alive) enemy.think(dt, target);
      else enemy.idle(dt);
      enemy.body.vel.y -= 24 * dt;
    }
    this.world.moveBody(enemy.body, dt);
  }
  private present(enemy: E, dt: number, target: EnemyTarget) {
    enemy.yaw = angleLerp(enemy.yaw, enemy.navigation.heading, 1 - Math.exp(-10 * dt));
    enemy.root.position.copy(enemy.body.pos);
    enemy.root.rotation.y = enemy.yaw;
    if (!enemy.T.flying) this.separateTarget(enemy.body, target.body.pos);
    enemy.animate(dt, target.center);
    enemy.syncHit();
  }
  private separateTarget(body: Body, target: Vector3) {
    const radius = 0.36 + body.halfW + 0.12,
      dx = body.pos.x - target.x,
      dz = body.pos.z - target.z,
      squared = dx * dx + dz * dz;
    if (squared >= radius * radius || Math.abs(body.pos.y - target.y) >= 1.7) return;
    const distance = Math.sqrt(squared) || 0.0001,
      push = radius - distance;
    body.pos.x += (dx / distance) * push;
    body.pos.z += (dz / distance) * push;
    if (this.world.overlapsBody(body)) {
      body.pos.x -= (dx / distance) * push;
      body.pos.z -= (dz / distance) * push;
    }
  }
  private separate(dt: number) {
    this.separationTime -= dt;
    if (this.separationTime > 0) return;
    this.separationTime = 0.05;
    const actors = this.population();
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.alive || a.T.flying) continue;
      for (let j = i + 1; j < actors.length; j++) {
        const b = actors[j];
        if (!b.alive || b.T.flying) continue;
        const dx = b.body.pos.x - a.body.pos.x,
          dz = b.body.pos.z - a.body.pos.z,
          squared = dx * dx + dz * dz,
          radius = a.body.halfW + b.body.halfW + 0.75;
        if (
          squared > radius * radius ||
          squared < 1e-6 ||
          Math.abs(b.body.pos.y - a.body.pos.y) > 1.5
        )
          continue;
        const distance = Math.sqrt(squared),
          push = (radius - distance) * 9;
        a.body.vel.x -= (dx / distance) * push;
        a.body.vel.z -= (dz / distance) * push;
        b.body.vel.x += (dx / distance) * push;
        b.body.vel.z += (dz / distance) * push;
      }
    }
  }
}
