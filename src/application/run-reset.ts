import type { Object3D, Vector3 } from 'three';
import type { MapKey } from '../domain/maps.js';
import type { SceneResourcePort } from '../engine/ports.js';
import type { RunGame } from './session-contracts.js';
interface RunPlayer {
  maxHp: number;
  regenDelay: number;
  regenRate: number;
  name: string;
  lastHitBy: string | null;
  lastHit: { from?: number[] | null; crit?: boolean; amount?: number; src?: string } | null;
  reset(position: Vector3): void;
}
export interface RunResetPorts {
  state: {
    level: { breakables: readonly { alive: boolean }[]; playerStart: Vector3 };
    loadedKey: MapKey;
    arenaLoaded: boolean;
    myName: string;
    pickups: { mesh: Object3D }[];
    pickupClock: number;
  };
  game: RunGame;
  player: RunPlayer;
  resources: SceneResourcePort;
  enemies: { clear(): void; mods: { speed: number; damage: number } };
  effects: { clear(): void };
  hud: {
    setModifier(label: string): void;
    setBoss(name: string | null, fraction: number | null): void;
    setScore(points: number, combo: number): void;
    setTimer(label: string): void;
    setPvpScore(html: string | null): void;
    setWave(wave: number, alive: number): void;
    setBoard(html: string | null): void;
  };
  online(): boolean;
  setLevel(key: MapKey, arena: boolean, force: boolean): void;
  endFocus(): void;
}
/** Reset recipe owns run counters/resources; input and screen adapters have no reset authority. */
export class RunReset {
  constructor(private readonly ports: RunResetPorts) {}
  reset() {
    const { state, setLevel, enemies, effects, resources, player, online, hud, game, endFocus } =
      this.ports;
    if (state.level.breakables.some((prop) => !prop.alive))
      setLevel(state.loadedKey, state.arenaLoaded, true);
    enemies.clear();
    effects.clear();
    for (const pickup of state.pickups) resources.release(pickup.mesh);
    state.pickups.length = 0;
    state.pickupClock = 0;
    player.maxHp = online() ? 110 : 120;
    player.regenDelay = online() ? 4 : 4.5;
    player.regenRate = online() ? 14 : 11;
    player.reset(state.level.playerStart);
    player.name = state.myName;
    player.lastHitBy = null;
    player.lastHit = null;
    enemies.mods.speed = 1;
    enemies.mods.damage = 1;
    hud.setModifier('');
    hud.setBoss(null, null);
    game.boss = null;
    endFocus();
    game.katanaStreak = 0;
    game.score = 0;
    game.kills = 0;
    game.combo = 0;
    game.wave = 0;
    game.intermission = 0;
    game.queue = [];
    game.time = 0;
    game.over = null;
    game.matchT = 0;
    hud.setScore(0, 0);
    hud.setTimer('');
    hud.setPvpScore(null);
    hud.setWave(1, 0);
    hud.setBoard(null);
  }
  clearWave() {
    const { enemies, effects, endFocus, game } = this.ports;
    enemies.clear();
    effects.clear();
    enemies.mods.speed = 1;
    enemies.mods.damage = 1;
    endFocus();
    game.intermission = 0;
    game.queue = [];
  }
}
