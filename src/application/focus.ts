import { Vector3 } from 'three';
import type { Body } from '../engine/physics.js';
import { FOCUS_TIME, FOCUS_RANGE, FOCUS_MAX_CHAIN, FOCUS_ARM } from '../domain/focus.js';
import { INK } from '../shared/ink.js';
import { FocusDash } from '../gameplay/focus/dash.js';
import type { FocusTarget } from '../gameplay/focus/contracts.js';
import type { FocusPorts } from './focus-contracts.js';

/** Owns solo focus selection, arming/chain policy and execution through scoped capabilities. */
export class FocusController<T extends FocusTarget> {
  private readonly offset = new Vector3();
  private readonly motion: FocusDash<T>;
  constructor(private readonly ports: FocusPorts<T>) {
    const { state, player, world, audio, input, effects, marker, slash, hud } = ports;
    this.motion = new FocusDash({
      state,
      player,
      world,
      began: () => {
        audio.dash();
        player.kickFov(5);
        input.rumble(0.5, 0.4, 120);
        marker(null);
      },
      trail: (from, to) => effects.tracer(from, to, INK.BLUE, 0.045, 0.28),
      stroke: (point) => effects.strokeBurst(point, INK.BLUE, 2, 5, { life: 0.22, size: 0.03 }),
      blocked: () => {
        slash();
        audio.katanaSwing();
        hud.tip('blocked · the dash did not reach', 1.2);
      },
      arrived: (target) => this.focusExecute(target),
    });
  }
  focusCandidate(): T | null {
    const { targets, player, world } = this.ports;
    let best: T | null = null,
      bestScore = -1;
    for (const target of targets()) {
      if (!target.alive || target.state === 'spawn') continue;
      this.offset.subVectors(target.center, player.eye);
      const distance = this.offset.length();
      if (distance > FOCUS_RANGE || distance < 0.5) continue;
      const aim = this.offset.divideScalar(distance).dot(player.forward);
      if (aim < 0.4 || !world.hasLineOfSight(player.eye, target.center)) continue;
      const score = aim * 3 - distance / FOCUS_RANGE;
      if (score > bestScore) {
        bestScore = score;
        best = target;
      }
    }
    return best;
  }
  enterFocus() {
    const { state, online, audio, hud } = this.ports;
    if (online() || state.chain >= FOCUS_MAX_CHAIN || !this.focusCandidate()) return;
    const fresh = !state.active;
    state.active = true;
    state.t = FOCUS_TIME;
    state.chain++;
    state.arm = FOCUS_ARM;
    state.ready = false;
    if (fresh) {
      audio.focusIn();
      hud.tip(`<b>SLASH READY</b> · hold ${hud.key('focus')} to dash`, 2.2);
    }
  }
  endFocus() {
    const { state, resetCharge, marker } = this.ports;
    if (!state.active && !state.dash) return;
    state.active = false;
    state.target = null;
    state.chain = 0;
    this.motion.clear();
    resetCharge();
    marker(null);
  }
  startFocusDash(target: T) {
    this.motion.start(target);
  }
  marchBody(body: Body, nx: number, nz: number, distance: number) {
    return this.motion.marchBody(body, nx, nz, distance);
  }
  updateFocusDash(dt: number) {
    return this.motion.update(dt);
  }
  endDash(blocked: boolean) {
    this.motion.stop(blocked);
  }
  focusExecute(target: T) {
    const { state, player, damage, slash, audio, hitstop, effects, input, marker } = this.ports;
    this.motion.stop(false);
    slash();
    this.offset.subVectors(target.center, player.eye);
    const direction = this.offset.clone().normalize();
    const chainBefore = state.chain;
    damage(target, 100000, {
      point: target.center.clone(),
      dir: direction,
      part: 'head',
      source: 'focus',
      crit: true,
    });
    audio.focusSlash();
    hitstop(0.1, 0.08);
    effects.shakeAmt += 0.35;
    input.rumble(0.9, 0.7, 140);
    player.kickFov(6);
    player.hp = Math.min(player.maxHp, player.hp + 6);
    if (state.chain === chainBefore) state.t = Math.min(state.t, 0.35);
    state.target = null;
    marker(null);
  }
  updateFocus(dt: number) {
    const { state, player, input, marker } = this.ports;
    if (!state.active) return;
    if (state.dash) {
      this.updateFocusDash(dt);
      return;
    }
    state.t -= dt;
    state.arm -= dt;
    if (state.t <= 0 || !player.alive) {
      this.endFocus();
      return;
    }
    const combo = (input.down('aim') && input.down('fire')) || input.down('dash');
    if (!combo) state.ready = true;
    const target = this.focusCandidate();
    state.target = target;
    marker(target?.center ?? null);
    if (!target) return;
    if (combo && state.ready && state.arm <= 0) {
      input.consume('fire');
      this.startFocusDash(target);
    }
  }
}
