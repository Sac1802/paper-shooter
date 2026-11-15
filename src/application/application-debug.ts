import type { createRuntime } from './runtime.js';
import type { WaveController } from './waves.js';
import type { SessionController } from './session-controller.js';
import type { PickupController } from './pickups.js';
import type { FocusController } from './focus.js';
import type { EnemyActor } from '../gameplay/enemies/actor.js';
import type { createMultiplayer } from './multiplayer.js';
import type { GamePhase } from '../domain/match.js';
type Runtime = ReturnType<typeof createRuntime>;
export type DebugCommands = Pick<WaveController, 'startWave' | 'updateWaves' | 'pickSpawn'> &
  Pick<
    SessionController,
    'begin' | 'beginAtWave' | 'jumpToWave' | 'resetGame' | 'startMatch' | 'hostStart'
  > &
  Pick<PickupController, 'spawnPickup'> &
  Pick<FocusController<EnemyActor>, 'focusCandidate' | 'enterFocus'> &
  Pick<
    ReturnType<typeof createMultiplayer>,
    'createLobby' | 'joinLobby' | 'quickPlay' | 'leaveOnline'
  >;
/** Existing development/browser diagnostics; commands are registered before animation starts. */
export type ApplicationDebug = Runtime &
  Partial<DebugCommands> & {
    readonly level: Runtime['state']['level'];
    readonly nav: Runtime['state']['nav'];
    inspect(): {
      state: GamePhase;
      mode: 'solo' | 'ffa';
      map: string;
      wave: number;
      hp: number;
      alive: number;
      weapon: string;
    };
  };
declare global {
  interface Window {
    __game?: ApplicationDebug;
  }
}
