import type { Vector3 } from 'three';
import type { EnemyKind } from '../domain/enemies.js';
import type { MapKey } from '../domain/maps.js';
import type { Score } from '../domain/match.js';

export type GamePhase = 'start' | 'lobby' | 'play' | 'pause' | 'dying' | 'dead' | 'over';
export interface Winner {
  id: string;
  name: string;
}
export interface SessionGame {
  state: GamePhase;
  mode: 'solo' | 'ffa';
  menu: boolean;
  over: Winner | null;
  clockStarted: boolean;
  respawnT: number;
  respawnArm: number;
}
export interface SessionScreen {
  screen: 'main' | 'online' | 'lobby';
  myName: string;
  mapKey: MapKey;
  musicWanted: boolean;
  matchLeft: number;
  clockT: number;
}
export interface SessionInput {
  readonly usingGamepad: boolean;
  readonly pointerLocked: boolean;
  readonly lastActive: number;
  requestLock(): void;
  exitLock(): void;
}
export interface SessionAudio {
  readonly musicPlaying: boolean;
  init(): void;
  resume(): void;
  musicOn(playing: boolean): void;
  reelLoop(playing: boolean): void;
}
export interface SessionHud {
  hideScreen(): void;
  setGameplayVisible(visible: boolean): void;
  setBoard(html: string | null): void;
  message(title: string, detail: string, duration: number): void;
  tip(html: string, duration: number): void;
  key(action: string): string;
}
export interface SessionPresentation {
  start(): void;
  pause(): void;
  clickToPlay(): void;
}
export interface SessionTransport {
  readonly id: string | null;
  readonly isHost: boolean;
  inMatch: boolean;
  send(type: 'backtolobby', data: Record<string, never>): void;
  send(type: 'start', data: { spawns: Record<string, number>; map: MapKey }): void;
}
export interface SessionPorts {
  game: SessionGame;
  screen: SessionScreen;
  input: SessionInput;
  audio: SessionAudio;
  hud: SessionHud;
  presentation: SessionPresentation;
  transport: SessionTransport;
  lobby: { players: ReadonlyMap<string, { name: string }>; map: MapKey | null };
  scores: Map<string, Score>;
  player: { reset(position: Vector3): void; shieldT: number };
  remote: () => Iterable<{ lastSeen: number }>;
  setArena(arena: boolean): void;
  resetRun(): void;
  clearWave(): void;
  startWave(wave: number): void;
  spawnSpots(): readonly Vector3[];
  arenaSpawn(): Vector3;
  sendScores(): void;
  refreshScores(): void;
}
export interface RunGame {
  boss: { alive: boolean } | null;
  katanaStreak: number;
  score: number;
  kills: number;
  combo: number;
  wave: number;
  intermission: number;
  queue: EnemyKind[];
  time: number;
  over: Winner | null;
  matchT: number;
}
