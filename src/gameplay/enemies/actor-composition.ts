import type { Body } from '../../engine/physics.js';
import type { EnemyDefinition } from '../../domain/enemy-definitions.js';
import type { EnemyModel } from '../../presentation/models/enemy.js';
import { EnemyDisassembly } from '../../presentation/characters/disassembly.js';
import { EnemyHitFeedback } from '../../presentation/characters/hit-feedback.js';
import { EnemyLaser } from '../../presentation/characters/laser.js';
import { EnemySlash } from '../../presentation/characters/melee-slash.js';
import { WalkerAnimation } from '../../presentation/characters/walker-animation.js';
import { FlyerAnimation } from '../../presentation/characters/flyer-animation.js';
import { animationFrame } from '../../presentation/characters/animation-contracts.js';
import { EnemyCombat } from './combat.js';
import { EnemyNavigation } from './navigation.js';
import { EnemyPerception } from './perception.js';
import { BomberBehavior } from './bomber-behavior.js';
import { BladeBehavior } from './blade-behavior.js';
import { FlyerBehavior } from './flyer-behavior.js';
import { createRangedAttack } from './ranged-attack.js';
import { createRangedBehavior } from './ranged-behavior.js';
import { createBossBehavior } from './boss-factory.js';
import type { drawEnemySeed } from './seed.js';
import type { EnemyActorServices, EnemyActorRef } from './actor-contracts.js';
interface Construction {
  definition: EnemyDefinition;
  model: EnemyModel;
  body: Body;
  seed: ReturnType<typeof drawEnemySeed>;
  slot: number;
  yaw: () => number;
}
interface Lifecycle {
  identity: EnemyActorRef;
  wake(): void;
  stun(duration: number): void;
  stunned(): void;
  recovered(): void;
}
/** Construction-only recipes. Leaf owners receive explicit ports, never this construction frame or the actor. */
export function composeEnemy(context: Construction, life: Lifecycle, services: EnemyActorServices) {
  const { definition: T, model, body, seed } = context,
    { environment, feedback, policy } = services;
  const navigation = new EnemyNavigation(
    body,
    { world: environment.world, navigation: environment.navigation, speed: policy.speedModifier },
    { weapon: T.weapon, angle: context.slot * 2.39996, delay: seed.formationDelay },
  );
  const clock = { remaining: seed.cooldown };
  const animation =
    model.kind === 'flying'
      ? new FlyerAnimation(model.J, seed.animationPhase)
      : new WalkerAnimation(T, model.J, seed.animationPhase);
  const hitFeedback = new EnemyHitFeedback(
    model.mat,
    { center: model.center, ink: T.ink, boss: T.boss },
    feedback,
  );
  const disassembly =
    model.kind === 'walking'
      ? new EnemyDisassembly(
          T,
          model,
          { center: model.center, position: body.pos, yaw: context.yaw },
          {
            scene: environment.scene,
            effects: feedback.effects,
            audio: feedback.audio,
            shieldBroken: policy.shieldBroken,
          },
        )
      : null;
  const combat = makeCombat(context, life, services, hitFeedback, disassembly);
  const telegraph = new EnemyLaser(environment.scene, environment.resources);
  const perception = new EnemyPerception(
    body.pos,
    (out) => out.setFromMatrixPosition(model.parts.head.matrixWorld),
    environment.world,
  );
  const bomber =
    T.weapon === 'bomb'
      ? new BomberBehavior(T, body, navigation, {
          flash: () => hitFeedback.flash(0.02),
          fuse: () => feedback.audio.fuse(model.center),
          explode: () => policy.explode(life.identity),
        })
      : null;
  const blade = makeBlade(context, life, services, navigation, clock);
  const ranged = createRangedAttack(T, model.tip, clock, {
    center: model.center,
    damageModifier: policy.damageModifier,
    laser: telegraph,
    audio: feedback.audio,
    effects: feedback.effects,
    emit: (position, direction, shot) => policy.emit(life.identity, position, direction, shot),
  });
  const rangedBehavior = createRangedBehavior(T, body, navigation, {
    attack: ranged,
    localSpeed: policy.localSpeed,
    keepMultiplier: seed.keepMultiplier,
    strafeDirection: seed.strafeDirection,
    strafeDuration: seed.strafeDuration,
  });
  const flyer = makeFlyer(context, life, services, navigation, clock);
  const boss = createBossBehavior(
    T,
    { body, clock, motion: navigation },
    {
      center: model.center,
      targets: policy.targets,
      damageModifier: policy.damageModifier,
      speedModifier: policy.speedModifier,
      feedback: feedback.boss,
      head: (out) => out.setFromMatrixPosition(model.parts.head.matrixWorld),
      torso: (out) => out.setFromMatrixPosition(model.parts.torso.matrixWorld),
      emit: (position, direction, shot) => policy.emit(life.identity, position, direction, shot),
      blast: (point, radius, damage) => policy.blast(life.identity, point, radius, damage),
      count: policy.count,
      spawnReady: policy.spawnReady,
    },
  );
  return {
    navigation,
    clock,
    animation,
    hitFeedback,
    combat,
    disassembly,
    telegraph,
    perception,
    bomber,
    blade,
    ranged,
    rangedBehavior,
    flyer,
    boss,
    animationFrame: animationFrame(body.vel, model.center),
  };
}
function makeCombat(
  context: Construction,
  life: Lifecycle,
  services: EnemyActorServices,
  feedback: EnemyHitFeedback,
  disassembly: EnemyDisassembly | null,
) {
  const { policy } = services;
  return new EnemyCombat(context.definition, {
    present: () => policy.present(life.identity),
    mirror: policy.mirror,
    damageModifier: policy.damageModifier,
    feedback,
    clientHit: (amount, impact) => policy.clientHit(life.identity, amount, impact),
    breakShield: () => {
      if (disassembly?.breakShield()) policy.shieldBroken();
    },
    wake: life.wake,
    bossChanged: () => policy.bossChanged(life.identity),
    hitstop: policy.hitstop,
    kill: (impact) => policy.kill(life.identity, impact),
  });
}
function makeBlade(
  context: Construction,
  life: Lifecycle,
  services: EnemyActorServices,
  navigation: EnemyNavigation,
  clock: { remaining: number },
) {
  const { definition: T, body, model, yaw } = context;
  if (T.weapon !== 'blade') return null;
  const slash = new EnemySlash(services.feedback.effects);
  return new BladeBehavior(T, body, navigation, clock, {
    center: model.center,
    damageModifier: services.policy.damageModifier,
    audio: services.feedback.audio,
    slash: () => slash.draw(model.center, yaw()),
    stun: life.stun,
  });
}
function makeFlyer(
  context: Construction,
  life: Lifecycle,
  services: EnemyActorServices,
  navigation: EnemyNavigation,
  clock: { remaining: number },
) {
  const { definition: T, body, model, seed } = context;
  if (T.weapon !== 'dive') return null;
  return new FlyerBehavior(
    T,
    body,
    clock,
    {
      center: model.center,
      orientation: navigation,
      world: services.environment.world,
      damageModifier: services.policy.damageModifier,
      speedModifier: services.policy.speedModifier,
      audio: services.feedback.audio,
      stunned: life.stunned,
      recovered: life.recovered,
    },
    { duration: seed.flyDuration, orbitDirection: seed.orbitDirection },
  );
}
export type EnemyComponents = ReturnType<typeof composeEnemy>;
