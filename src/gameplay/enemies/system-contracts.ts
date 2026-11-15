import type { Scene, Vector3 } from 'three';
import type { SceneResourcePort } from '../../engine/ports.js';
import type { EnemyActorServices, EnemyTarget } from './actor-contracts.js';
import type {
  ProjectileTarget,
  ProjectileEffects,
  ProjectilePorts,
} from '../projectile-contracts.js';
import type { EnemyMotionWorld } from './simulation.js';
import type {
  BossEffectsPort,
  BossSoundPort,
} from '../../presentation/characters/boss-feedback.js';
import type {
  EnemyDeathEffects,
  EnemyDeathAudio,
} from '../../presentation/characters/death-feedback.js';
export interface EnemySystemTarget extends EnemyTarget, ProjectileTarget {}
export interface EnemySystemServices {
  scene: Scene;
  resources: SceneResourcePort;
  world: EnemyMotionWorld & EnemyActorServices['environment']['world'];
  navigation: EnemyActorServices['environment']['navigation'];
  player: () => EnemySystemTarget;
  targets?: () => readonly EnemySystemTarget[];
  effects: EnemyActorServices['feedback']['effects'] &
    BossEffectsPort &
    ProjectileEffects &
    EnemyDeathEffects;
  audio: EnemyActorServices['feedback']['audio'] &
    BossSoundPort &
    EnemyDeathAudio &
    ProjectilePorts<never>['audio'] & { spawn(point: Vector3): void };
  hud: EnemyActorServices['feedback']['hud'];
  input: EnemyActorServices['feedback']['input'];
  hitstop(duration: number, scale: number): void;
  score(points: number, label: string): void;
}
