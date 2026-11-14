export interface EnemyDeathImpact {
  source: string;
  crit?: boolean;
}
export interface EnemyDeathDecision {
  sever: boolean;
  extreme: boolean;
}
/** Existing overkill classification also feeds kill/reward policy; presentation consumes its result. */
export function enemyDeathDecision(
  hp: number,
  maximumHp: number,
  impact: EnemyDeathImpact,
): EnemyDeathDecision {
  return {
    sever:
      -hp > maximumHp * 0.35 ||
      impact.source === 'katana' ||
      impact.crit === true ||
      impact.source === 'deflect' ||
      impact.source === 'blast',
    extreme: -hp > maximumHp * 0.6,
  };
}
