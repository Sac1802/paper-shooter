import type { EnemyDeathImpact } from './enemy-death.js';

/** Base reward before focus/airborne feedback; combo multiplication belongs to the score owner. */
export function killReward(
  definition: { readonly name: string; readonly score: number },
  impact: EnemyDeathImpact,
  severed: boolean,
) {
  let label = impact.crit ? 'HEADSHOT' : definition.name;
  let points = definition.score + (impact.crit ? 60 : 0);
  switch (impact.source) {
    case 'katana':
      label = severed ? 'SLICED' : 'CUT DOWN';
      points += 50;
      break;
    case 'focus':
      label = 'EXECUTED';
      points += 150;
      break;
    case 'deflect':
      label = 'RETURN TO SENDER';
      points += 120;
      break;
    case 'fall':
      label = 'FELL OFF THE PAGE';
      break;
  }
  return { label, points };
}
