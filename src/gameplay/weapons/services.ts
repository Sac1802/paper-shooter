import type { Vector3 } from 'three';
import type { GunImpactSpec } from './impact-contracts.js';
interface WeaponPose {
  eye: Vector3;
  right: Vector3;
  forward: Vector3;
  kickFov(amount: number): void;
}
interface GunShooter extends WeaponPose {
  aimDir(spread: number): Vector3;
  recoil(pitch: number, yaw: number): void;
}
export interface GunServices {
  player: () => GunShooter;
  impacts: {
    fire(
      spec: GunImpactSpec,
      origin: Vector3,
      direction: Vector3,
      readMuzzle: (out: Vector3) => void,
    ): boolean;
  };
  audio: {
    pump(): void;
    shell(): void;
    reload(): void;
    cylinder(): void;
    empty(): void;
    shot(): void;
    shotgunFire(): void;
    sniperFire(): void;
    revolver(): void;
  };
  effects: {
    shakeAmt: number;
    shell(point: Vector3, velocity: Vector3, ink: number, size: number): void;
    strokeBurst(
      point: Vector3,
      ink: number,
      count: number,
      speed: number,
      options: { life: number; size: number; gravity: number; drag: number },
    ): void;
    smoke(point: Vector3, direction: Vector3, count: number): void;
  };
  input: { rumble(strong: number, weak: number, milliseconds: number): void };
  hitstop(duration: number, scale: number): void;
}
export interface BladeServices {
  player: () => WeaponPose & { lunge(speed: number): void };
  impacts: {
    strike(
      eye: Vector3,
      forward: Vector3,
      direction: Vector3,
      slash: number,
      damage: number,
    ): boolean;
  };
  audio: { katanaSwing(): void; katanaHit(): void };
  effects: {
    shakeAmt: number;
    tracer(from: Vector3, to: Vector3, ink: number, thickness: number, life: number): void;
  };
  input: { rumble(strong: number, weak: number, milliseconds: number): void };
  hitstop(duration: number, scale: number): void;
}
