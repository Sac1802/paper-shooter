import { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import { clamp } from '../../engine/math.js';
import { DASH_SPEED } from '../../domain/focus.js';
import type { FocusDashState, FocusMotionPlayer, FocusState, FocusTarget } from './contracts.js';

interface DashPorts<T extends FocusTarget> {
  state: Pick<FocusState<T>, 'dash'>;
  player: FocusMotionPlayer;
  world: { overlapsBody(body: Body): boolean };
  began(): void;
  trail(from: Vector3, to: Vector3): void;
  stroke(point: Vector3): void;
  blocked(): void;
  arrived(target: T): void;
}
/** Collision/steering/trail progress only; selection, window, damage and healing belong to focus policy. */
export class FocusDash<T extends FocusTarget> {
  private readonly offset = new Vector3();
  constructor(private readonly ports: DashPorts<T>) {}
  start(target: T) {
    const { player, state, began } = this.ports;
    state.dash = { target, t: 0, trail: player.center.clone(), lastTrail: 0 };
    player.dashLock = true;
    player.body.vel.set(0, 0, 0);
    began();
  }
  /** Leaving focus releases motion ownership without erasing the actor's current velocity. */
  clear() {
    this.ports.state.dash = null;
    this.ports.player.dashLock = false;
  }
  stop(blocked: boolean) {
    this.clear();
    this.ports.player.body.vel.set(0, 0, 0);
    if (blocked) this.ports.blocked();
  }
  marchBody(body: Body, nx: number, nz: number, distance: number) {
    let moved = 0;
    for (let step = Math.min(0.22, distance); moved + 1e-4 < distance;) {
      const amount = Math.min(step, distance - moved);
      body.pos.x += nx * amount;
      body.pos.z += nz * amount;
      if (this.ports.world.overlapsBody(body)) {
        body.pos.y += 0.65;
        if (this.ports.world.overlapsBody(body)) {
          body.pos.y -= 0.65;
          body.pos.x -= nx * amount;
          body.pos.z -= nz * amount;
          return moved;
        }
      }
      moved += amount;
    }
    return moved;
  }
  update(dt: number) {
    const { state, player, trail, stroke, arrived } = this.ports;
    const dash = state.dash;
    if (!dash) return true;
    const target = dash.target;
    dash.t += dt;
    if (!target.alive || dash.t > 1.2) {
      this.stop(false);
      return true;
    }
    const body = player.body;
    const dx = target.body.pos.x - body.pos.x,
      dz = target.body.pos.z - body.pos.z;
    const flat = Math.hypot(dx, dz);
    const nx = dx / (flat || 1),
      nz = dz / (flat || 1);
    player.yaw = Math.atan2(-dx, -dz);
    this.offset.subVectors(target.center, player.eye);
    player.pitch = clamp(
      Math.atan2(this.offset.y, Math.hypot(this.offset.x, this.offset.z)),
      -1.2,
      1.2,
    );
    const want = Math.max(0, flat - 1.1);
    const moved = this.marchBody(body, nx, nz, Math.min(DASH_SPEED * dt, want));
    const dy = target.body.pos.y + (target.T.flying ? 0.2 : 0) - body.pos.y;
    this.climb(dash, body, dy, dt);
    dash.lastTrail += dt;
    if (dash.lastTrail > 0.02) {
      dash.lastTrail = 0;
      trail(dash.trail, player.center);
      dash.trail.copy(player.center);
      stroke(player.center);
    }
    const reach = Math.hypot(flat, Math.max(0, Math.abs(dy) - 0.6));
    if (reach <= 1.5) {
      arrived(target);
      return true;
    }
    if (moved < 1e-4 && want > 0.05 && (dash.stuckY || 0) > 0.08) {
      this.stop(true);
      return true;
    }
    return false;
  }
  private climb(dash: FocusDashState<T>, body: Body, dy: number, dt: number) {
    if (Math.abs(dy) <= 0.05) return;
    const y = body.pos.y;
    body.pos.y += clamp(dy, -DASH_SPEED * dt, DASH_SPEED * dt);
    if (this.ports.world.overlapsBody(body)) {
      body.pos.y = y;
      dash.stuckY = (dash.stuckY || 0) + dt;
    } else dash.stuckY = 0;
  }
}
