import type { Vector3 } from 'three';
import type { EnemyDeathImpact } from './enemy-death.js';
export interface EnemyImpact extends EnemyDeathImpact {
  part?: string;
  point?: Vector3;
  dir?: Vector3;
}
