import type { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import type { EnemyDefinition } from '../../domain/enemy-definitions.js';
import type { BossFeedbackPort } from '../../presentation/characters/boss-feedback.js';
import type { EnemyAttackClock, DirectedEnemyMotion } from './behavior-contracts.js';
import type { BossBehavior, BossBullet, BossTarget, BossSpawnPort } from './boss-contracts.js';
import { DoodlerBehavior } from './doodler-behavior.js';
import { EraserBehavior } from './eraser-behavior.js';
import { InkblotBehavior } from './inkblot-behavior.js';
export interface BossServices extends BossSpawnPort {
  center: Vector3;
  targets: () => readonly BossTarget[];
  damageModifier: () => number;
  speedModifier: () => number;
  feedback: BossFeedbackPort;
  head(out: Vector3): Vector3;
  torso(out: Vector3): Vector3;
  emit(position: Vector3, direction: Vector3, shot: BossBullet): void;
  blast(position: Vector3, radius: number, damage: number): void;
}
export function createBossBehavior(
  definition: EnemyDefinition,
  actor: { body: Body; clock: EnemyAttackClock; motion: DirectedEnemyMotion },
  services: BossServices,
): BossBehavior | null {
  if (definition.weapon !== 'boss') return null;
  const common = {
    center: services.center,
    targets: services.targets,
    damageModifier: services.damageModifier,
    feedback: services.feedback,
  };
  const { body, clock, motion } = actor;
  if (definition.bossKind === 'eraser')
    return new EraserBehavior(definition, body, clock, motion, {
      ...common,
      count: services.count,
      spawnReady: services.spawnReady,
      speedModifier: services.speedModifier,
    });
  if (definition.bossKind === 'inkblot')
    return new InkblotBehavior(definition, body, clock, motion, {
      ...common,
      count: services.count,
      spawnReady: services.spawnReady,
      torso: services.torso,
      emit: services.emit,
    });
  return new DoodlerBehavior(definition, body, clock, motion, {
    ...common,
    head: services.head,
    emit: services.emit,
    blast: services.blast,
  });
}
