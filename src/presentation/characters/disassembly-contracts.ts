import type { Object3D, Vector3, Scene } from 'three';
export interface DisassemblyEffects {
  debris(
    object: Object3D,
    position: Vector3,
    velocity: Vector3,
    angular: Vector3,
    options: { radius: number; blood: boolean; life: number },
  ): void;
  fountain(position: Vector3, direction: Vector3, amount: number, ink: number): void;
  bloodPool(position: Vector3, radius: number, ink: number): void;
  blood(position: Vector3, direction: Vector3, amount: number, options: { ink: number }): void;
}
export interface DisassemblyPorts {
  scene: Scene;
  effects: DisassemblyEffects;
  audio: { gib(center: Vector3): void; shieldHit(center: Vector3): void };
  shieldBroken(): void;
}
export interface DisassemblyPose {
  position: Vector3;
  center: Vector3;
  yaw: () => number;
}
