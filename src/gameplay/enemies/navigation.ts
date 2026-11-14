import * as THREE from 'three';
import type { Body } from '../../engine/physics.js';
import type { RaycastPort } from '../../engine/ports.js';
import { rand, clamp, damp } from '../../engine/math.js';
export type NavigationRoute = THREE.Vector3[] & { complete?: boolean };
export interface NavigationPort {
  findPath(from: THREE.Vector3, to: THREE.Vector3): NavigationRoute | null;
}
export interface NavigationServices {
  world: RaycastPort;
  navigation: () => NavigationPort;
  speed: () => number;
}
/** Owns route, formation offset and obstacle recovery for one body. */
export class EnemyNavigation {
  private path: NavigationRoute | null = null;
  private index = 0;
  private deadline = 0;
  private destination: THREE.Vector3 | null = null;
  private stuck = 0;
  private angle: number;
  private radius = 0;
  private formationDeadline: number;
  private readonly goal = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly down = new THREE.Vector3();
  constructor(
    private readonly body: Body,
    private readonly ports: NavigationServices,
    private readonly formation: { weapon: string; angle: number; delay: number },
  ) {
    this.angle = formation.angle;
    this.formationDeadline = formation.delay;
  }
  invalidate() {
    this.path = null;
  }
  meleeObstacle(dt: number) {
    this.stuck += dt;
    if (this.stuck > 0.25) {
      this.body.vel.y = 9;
      this.stuck = 0;
    }
  }
  steer(gx: number, gz: number, speed: number, accel: number, dt: number): number | null {
    const b = this.body;
    let dx = gx - b.pos.x,
      dz = gz - b.pos.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) {
      b.vel.x = damp(b.vel.x, 0, 8, dt);
      b.vel.z = damp(b.vel.z, 0, 8, dt);
      return null;
    }
    dx /= l;
    dz /= l;
    const a = (b.onGround ? accel : accel * 0.3) * dt;
    speed *= this.ports.speed();
    b.vel.x += clamp(dx * speed - b.vel.x, -a, a);
    b.vel.z += clamp(dz * speed - b.vel.z, -a, a);
    return Math.atan2(dx, dz);
  }
  groundAhead(dx: number, dz: number) {
    this.origin.set(this.body.pos.x + dx * 0.9, this.body.pos.y + 0.5, this.body.pos.z + dz * 0.9);
    return this.ports.world.raycast(this.origin, this.down.set(0, -1, 0), 3.5) !== null;
  }
  approachPoint(dt: number, target: THREE.Vector3, out: THREE.Vector3) {
    this.formationDeadline -= dt;
    if (this.formationDeadline <= 0) {
      this.formationDeadline = rand(2.5, 5);
      this.angle += rand(-0.7, 0.7); // drift, keep the slot
      const melee = this.formation.weapon === 'blade' || this.formation.weapon === 'bomb';
      this.radius = melee ? rand(2, 4.5) : rand(4.5, 9);
    }
    const d = Math.hypot(target.x - this.body.pos.x, target.z - this.body.pos.z);
    // hold a minimum standoff so they close in on their own side instead of stacking on one point
    let r = clamp(d * 0.55, Math.min(2, d * 0.9), this.radius);
    // while climbing to a different level the route is often a narrow ramp, and a wide offset
    // walks them straight off the side of it, so aim much closer to the actual target
    if (Math.abs(target.y - this.body.pos.y) > 1.5) r = Math.min(r, 1.1);
    return out.set(
      target.x + Math.cos(this.angle) * r,
      target.y,
      target.z + Math.sin(this.angle) * r,
    );
  }
  follow(dt: number, target: THREE.Vector3, speed: number): number | null {
    const nav = this.ports.navigation();
    this.deadline -= dt;
    const approach = this.approachPoint(dt, target, this.goal);
    this.refreshRoute(approach, nav);
    const goal = this.waypoint(approach);
    const yaw = this.steer(goal.x, goal.z, speed, 40, dt);
    this.recoverObstacle(dt, goal);
    return yaw;
  }
  private refreshRoute(target: THREE.Vector3, nav: NavigationPort) {
    const b = this.body;
    const stale =
      !this.path ||
      this.index >= this.path.length ||
      (this.deadline <= 0 &&
        (!this.destination || this.destination.distanceTo(target) > 3.5 || !this.path.complete));
    if (!stale || (this.deadline > 0 && this.path)) return;
    this.deadline = 0.8 + rand(0, 0.6);
    const p = nav.findPath(b.pos, target);
    if (p && p.length) {
      this.path = p;
      this.index = 0;
      this.destination = target.clone();
      while (
        this.index < p.length - 1 &&
        Math.hypot(p[this.index].x - b.pos.x, p[this.index].z - b.pos.z) < 0.7 &&
        Math.abs(p[this.index].y - b.pos.y) < 1
      )
        this.index++;
    }
  }
  private waypoint(target: THREE.Vector3): THREE.Vector3 {
    const b = this.body;
    if (!this.path || this.index >= this.path.length) return target;
    const node = this.path[this.index];
    const distance = Math.hypot(node.x - b.pos.x, node.z - b.pos.z);
    if (distance >= 0.5 || Math.abs(node.y - b.pos.y) >= 1.2) return node;
    this.index++;
    return this.index < this.path.length ? this.path[this.index] : target;
  }
  private recoverObstacle(dt: number, goal: THREE.Vector3) {
    const b = this.body;
    if (!b.onGround) return;
    const distance = Math.hypot(goal.x - b.pos.x, goal.z - b.pos.z);
    if (goal.y > b.pos.y + 0.6 && distance < 1.7) {
      b.vel.y = 9;
      b.onGround = false;
      return;
    }
    if (!b.hitWall) {
      this.stuck = 0;
      return;
    }
    this.stuck += dt;
    if (this.stuck > 0.35 && this.stuck < 0.4) this.deadline = 0;
    if (this.stuck > 0.9) {
      b.vel.y = 9;
      b.onGround = false;
      this.stuck = 0;
      this.deadline = 0;
    }
  }
}
