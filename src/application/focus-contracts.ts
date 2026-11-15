import type { Vector3 } from 'three';
import type { Body } from '../engine/physics.js';
import type { EnemyImpact } from '../domain/enemy-impact.js';
import type {
  FocusState,
  FocusTarget,
  FocusPlayer,
  FocusEffects,
} from '../gameplay/focus/contracts.js';

export interface FocusPorts<T extends FocusTarget> {
  state: FocusState<T>;
  player: FocusPlayer;
  targets(): Iterable<T>;
  damage(target: T, amount: number, impact: EnemyImpact): void;
  world: { hasLineOfSight(from: Vector3, to: Vector3): boolean; overlapsBody(body: Body): boolean };
  online(): boolean;
  slash(): void;
  resetCharge(): void;
  hitstop(duration: number, scale: number): void;
  marker(point: Vector3 | null): void;
  audio: { focusIn(): void; dash(): void; katanaSwing(): void; focusSlash(): void };
  hud: { tip(html: string, duration: number): void; key(action: string): string };
  input: {
    down(action: string): boolean;
    consume(action: string): void;
    rumble(strong: number, weak: number, duration: number): void;
  };
  effects: FocusEffects;
}
