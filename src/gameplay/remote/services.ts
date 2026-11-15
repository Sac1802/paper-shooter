import type { Scene, Vector3 } from 'three';
import type { SceneResourcePort, ResourceLeasePort } from '../../engine/ports.js';
import type { RemoteDeathEffects } from '../../presentation/characters/remote-ragdoll.js';
export interface RemoteServices {
  scene: Scene;
  resources: SceneResourcePort & ResourceLeasePort;
  effects: RemoteDeathEffects;
  localEye(): Vector3 | null;
}

export interface RemoteDamageTarget {
  readonly id: string;
  readonly alive: boolean;
}
