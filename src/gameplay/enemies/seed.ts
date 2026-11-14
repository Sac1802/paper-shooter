import { TAU } from '../../engine/math.js';
/** Retain every original draw, including values unused by a particular archetype, for replay compatibility. */
export function drawEnemySeed(random: () => number = Math.random) {
  const between = (min: number, max: number) => min + random() * (max - min);
  return {
    yaw: between(0, TAU),
    animationPhase: between(0, TAU),
    cooldown: between(0.6, 1.4),
    strafeDirection: random() < 0.5 ? 1 : -1,
    strafeDuration: between(1, 2),
    formationDelay: between(0, 2),
    keepMultiplier: between(0.75, 1.35),
    flyDuration: between(0, 3),
    orbitDirection: random() < 0.5 ? 1 : -1,
  };
}
