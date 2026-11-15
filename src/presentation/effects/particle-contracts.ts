import type { Vector3 } from 'three';
export type ParticleKind = 'drop' | 'stroke' | 'emitter';
export interface ParticleOptions {
  life?: number;
  size?: number;
  ink?: number;
  fill?: boolean;
  gravity?: number;
  drag?: number;
  collide?: 'decal' | null;
  stretch?: number;
  len?: number;
  axis?: Vector3 | null;
  decalSize?: number;
  shrink?: boolean;
  rate?: number;
  grow?: number;
}
export interface Particle {
  kind: ParticleKind;
  pos: Vector3;
  vel: Vector3 | null;
  life: number;
  maxLife: number;
  size: number;
  ink: number;
  fill: boolean;
  gravity: number;
  drag: number;
  collide: 'decal' | null;
  stretch: number;
  len: number;
  axis: Vector3 | null;
  decalSize: number;
  shrink: boolean;
  rate: number;
  acc: number;
  grow: number;
}
export interface ParticleSink {
  spawn(
    kind: ParticleKind,
    point: Vector3,
    velocity: Vector3 | null,
    options?: ParticleOptions,
  ): unknown;
}
export interface SplatSurface {
  splat(
    point: Vector3,
    normal: Vector3,
    ink: number,
    size: number,
    direction: Vector3 | null,
    cluster: number,
  ): void;
}
export type StrokeOptions = Pick<ParticleOptions, 'size' | 'life' | 'gravity' | 'stretch' | 'drag'>;
