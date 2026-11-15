import type { Vector3, Vector3Like } from 'three';
import type { EnemyKind } from '../domain/enemies.js';
import type { PickupKind } from '../domain/pickups.js';

export interface WaveBoss {
  readonly alive: boolean;
  hp: number;
  maxHp: number;
  readonly T: { readonly name: string };
}
export interface WaveActor extends WaveBoss {
  readonly T: { readonly name: string; readonly hp: number; readonly boss?: boolean };
}
export interface WaveState {
  wave: number;
  queue: EnemyKind[];
  spawnT: number;
  intermission: number;
  boss: WaveBoss | null;
  maxAlive: number;
}
export interface WaveLevel {
  readonly spawns: readonly Vector3[];
  readonly snipers: readonly Vector3[];
  readonly pickups: readonly Vector3[];
  readonly playerStart: Vector3;
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}
export interface WavePorts {
  state: WaveState;
  level(): WaveLevel;
  checkpoint(): number;
  saveCheckpoint(wave: number): void;
  player: {
    readonly center: Vector3;
    readonly eye: Vector3;
    readonly body: { readonly pos: Vector3 };
    readonly maxHp: number;
    readonly maxGrenades: number;
    hp: number;
    grenades: number;
  };
  enemies: {
    readonly alive: number;
    mods: { speed: number; damage: number };
    spawn(type: EnemyKind, position: Vector3): WaveActor;
  };
  world: {
    overlapsAABB(min: Vector3Like, max: Vector3Like): boolean;
    hasLineOfSight(from: Vector3, to: Vector3): boolean;
    groundBelow(x: number, y: number, z: number, distance: number): number;
  };
  hud: {
    setBoss(name: string | null, fraction: number | null): void;
    setModifier(label: string): void;
    message(title: string, detail: string, duration: number): void;
    key(action: string): string;
    tip(message: string, duration: number): void;
    kill(message: string, points: number): void;
    setTimer(label: string): void;
    setWave(wave: number, remaining: number): void;
  };
  audio: { bossRoar(point: Vector3): void; wave(): void; waveClear(): void };
  spawnPickup(kind: PickupKind, point: Vector3): void;
  score(points: number, label: string | null): void;
}
