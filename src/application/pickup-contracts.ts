import type { Group, Scene, Vector3 } from 'three';
import type { MapKey } from '../domain/maps.js';
import type { PickupKind } from '../domain/pickups.js';
import type { SceneResourcePort, ResourceLeasePort } from '../engine/ports.js';
import type { GamePayloads } from '../network/game-message-types.js';

export interface Pickup {
  id: number;
  kind: PickupKind;
  mesh: Group;
  base: number;
  t: number;
  life: number;
}
export interface PickupState {
  pickups: Pickup[];
  pickupClock: number;
}
export interface PickupPorts {
  state: PickupState;
  scene: Scene;
  resources: SceneResourcePort & ResourceLeasePort;
  map(): MapKey;
  spawnPoints(): readonly Vector3[];
  player: {
    readonly alive: boolean;
    readonly center: Vector3;
    readonly maxHp: number;
    readonly maxGrenades: number;
    hp: number;
    grenades: number;
    addAmmoAll(fraction: number): void;
  };
  transport: {
    readonly isHost: boolean;
    readonly active: boolean;
    send<K extends 'pickup' | 'taken' | 'take'>(kind: K, data: GamePayloads[K]): void;
  };
  collected(kind: PickupKind, point: Vector3): void;
}
