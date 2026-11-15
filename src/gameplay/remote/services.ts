import type { Scene, Object3D, Vector3 } from 'three';
import type { SceneResourcePort } from '../../engine/ports.js';
import type { Disposable } from '../../engine/resources.js';
export interface RemoteEffects {
  debris(
    mesh: Object3D,
    position: Vector3,
    velocity: Vector3,
    angularVelocity: Vector3,
    options: { radius: number; blood: boolean; life: number },
  ): void;
  blood(point: Vector3, direction: Vector3, amount: number): void;
  bloodPool(point: Vector3, size: number, ink: number): void;
}
export interface RemoteServices {
  scene: Scene;
  resources: SceneResourcePort & { retain(resources: Iterable<Disposable>): () => void };
  effects: RemoteEffects;
  localEye(): Vector3 | null;
}
