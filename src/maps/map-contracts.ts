import type { Object3D, Vector3, Vector3Like } from 'three';
import type { Collider, ColliderData } from '../engine/physics.js';
import type { PropVisual } from '../presentation/prop-feedback.js';
import type { MapKey } from '../domain/maps.js';
export interface MapWorld {
  addBox(min: Vector3Like, max: Vector3Like, data?: ColliderData): Collider;
  finalize(): unknown;
}
export interface MapBreakable extends PropVisual {
  id: number;
  alive: boolean;
  hp: number;
  box: Collider;
}
export interface Level {
  key: MapKey;
  rings: Vector3[];
  spawns: Vector3[];
  snipers: Vector3[];
  pickups: Vector3[];
  animated: { mesh?: Object3D; update(time: number): void }[];
  meshes: Object3D[];
  playerStart: Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  arenaSpawns: Vector3[];
  grappleMovers: { mesh: Object3D; radius: number }[];
  breakables: MapBreakable[];
}
export type WallGap = readonly [start: number, end: number, bottom?: number, top?: number];
export type WallPiece = [start: number, end: number, bottom: number, top: number];
export interface BoxOptions extends Pick<ColliderData, 'noNav' | 'noShoot' | 'noGrapple' | 'tag'> {
  noCollide?: boolean;
  ink?: number;
}
export interface StairOptions extends BoxOptions {
  rise?: number;
  run?: number;
}
export interface CylinderOptions extends BoxOptions {
  seg?: number;
}
export interface SphereOptions {
  ink?: number;
  seg?: number;
}
export interface PlaneOptions {
  scale?: number;
  ink?: number;
  rStep?: number;
  hStep?: number;
  speed?: number;
}
