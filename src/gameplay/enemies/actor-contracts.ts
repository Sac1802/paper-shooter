import type { Scene, Vector3 } from 'three';
import type { RaycastPort, SceneResourcePort } from '../../engine/ports.js';
import type { EnemyImpact } from '../../domain/enemy-impact.js';
import type { VisibilityPort } from './queries.js';
import type { NavigationPort } from './navigation.js';
import type { BossTarget, BossBullet } from './boss-contracts.js';
import type { MeleeTarget } from './behavior-contracts.js';
import type { EnemyHitEffects, EnemyHitPorts } from '../../presentation/characters/hit-feedback.js';
import type {
  DisassemblyEffects,
  DisassemblyPorts,
} from '../../presentation/characters/disassembly-contracts.js';
import type { EnemyTracerPort } from '../../presentation/characters/melee-slash.js';
import type { BossFeedbackPort } from '../../presentation/characters/boss-feedback.js';
import type { RangedAttackPorts, EnemyBullet } from './ranged-attack.js';
import type { BladeActions } from './blade-behavior.js';
import type { FlyerPorts } from './flyer-behavior.js';
export interface EnemyActorRef {
  id: number;
  alive: boolean;
  center: Vector3;
}
export interface EnemyTarget extends BossTarget, MeleeTarget {
  speed: number;
}
export interface EnemyActorServices {
  environment: {
    scene: Scene;
    resources: SceneResourcePort;
    world: RaycastPort & VisibilityPort;
    navigation: () => NavigationPort;
  };
  feedback: {
    effects: EnemyHitEffects & DisassemblyEffects & EnemyTracerPort & RangedAttackPorts['effects'];
    audio: EnemyHitPorts['audio'] &
      DisassemblyPorts['audio'] &
      RangedAttackPorts['audio'] &
      FlyerPorts['audio'] &
      BladeActions['audio'] & { fuse(center: Vector3): void };
    hud: EnemyHitPorts['hud'];
    input: EnemyHitPorts['input'];
    boss: BossFeedbackPort;
  };
  policy: {
    present(actor: EnemyActorRef): boolean;
    mirror: () => boolean;
    damageModifier: () => number;
    speedModifier: () => number;
    localSpeed: () => number;
    targets: () => readonly EnemyTarget[];
    kill(actor: EnemyActorRef, impact: EnemyImpact): void;
    clientHit(actor: EnemyActorRef, amount: number, impact: EnemyImpact): void;
    bossChanged(actor: EnemyActorRef): void;
    shieldBroken(): void;
    hitstop(duration: number, scale: number): void;
    explode(actor: EnemyActorRef, scale?: number): void;
    emit(
      actor: EnemyActorRef,
      position: Vector3,
      direction: Vector3,
      shot: EnemyBullet | BossBullet,
    ): void;
    blast(actor: EnemyActorRef, point: Vector3, radius: number, damage: number): void;
    count(kind: 'bomber' | 'flyer'): number;
    spawnReady(kind: 'bomber' | 'flyer', position: Vector3): void;
  };
}
