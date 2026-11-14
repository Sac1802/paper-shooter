import { expect, it } from 'vitest';
import { enemyDeathDecision } from '../../src/domain/enemy-death.js';
it.each([
  [100, 'rifle', false, false, false],
  [-35, 'rifle', false, false, false],
  [-35.1, 'rifle', false, true, false],
  [-60, 'rifle', false, true, false],
  [-60.1, 'rifle', false, true, true],
  [20, 'rifle', true, true, false],
  [100, 'katana', false, true, false],
  [100, 'focus', false, false, false],
  [100, 'blast', false, true, false],
  [100, 'deflect', false, true, false],
] as const)(
  'classifies death feedback and rewards at hp %s from %s (crit %s)',
  (hp, source, crit, sever, extreme) => {
    expect(enemyDeathDecision(hp, 100, { source, crit })).toEqual({ sever, extreme });
  },
);
