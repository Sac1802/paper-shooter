import type { Scene, Vector3 } from 'three';
import type { SceneResourcePort } from '../../engine/ports.js';
import type { RemoteDeathEffects } from '../../presentation/characters/remote-ragdoll.js';
import type { Disposable } from '../../engine/resources.js';
export interface RemoteServices {
  scene: Scene;
  resources: SceneResourcePort & { retain(resources: Iterable<Disposable>): () => void };
  effects: RemoteDeathEffects;
  localEye(): Vector3 | null;
}

export interface RemoteDamageTarget {
  readonly id: string;
  readonly alive: boolean;
}
