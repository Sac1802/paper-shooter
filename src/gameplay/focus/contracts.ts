import type { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';

export interface FocusTarget {
  readonly alive: boolean;
  readonly state: string;
  readonly center: Vector3;
  readonly body: { readonly pos: Vector3 };
  readonly T: { readonly flying?: boolean };
}
export interface FocusDashState<T> {
  target: T;
  t: number;
  trail: Vector3;
  lastTrail: number;
  stuckY?: number;
}
export interface FocusState<T> {
  active: boolean;
  t: number;
  chain: number;
  arm: number;
  ready: boolean;
  target: T | null;
  dash: FocusDashState<T> | null;
}
export interface FocusMotionPlayer {
  readonly body: Body;
  readonly eye: Vector3;
  readonly center: Vector3;
  yaw: number;
  pitch: number;
  dashLock: boolean;
}
export interface FocusPlayer extends FocusMotionPlayer {
  readonly alive: boolean;
  readonly forward: Vector3;
  readonly maxHp: number;
  hp: number;
  kickFov(amount: number): void;
}
export interface FocusEffects {
  shakeAmt: number;
  tracer(from: Vector3, to: Vector3, ink: number, thickness: number, life: number): void;
  strokeBurst(
    point: Vector3,
    ink: number,
    count: number,
    speed: number,
    options: { life: number; size: number },
  ): void;
}
