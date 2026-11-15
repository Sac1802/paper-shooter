import type { MapBuilder } from './builder.js';
import type { Level } from './map-contracts.js';
import type { Scene } from 'three';
import type { World } from '../engine/physics.js';
import type { MapKey } from '../domain/maps.js';
import { knownMap } from '../domain/maps.js';
import { createBuilder } from './builder.js';
import { buildDistrict } from './district.js';
import { buildMexico } from './mexico.js';
export { LEVELS } from '../domain/maps.js';

export type { MapKit, MapBuilder } from './builder.js';
export type { Level } from './map-contracts.js';

// Adding a map key requires a builder here; each map uses the same construction contract.
const builders: Record<MapKey, MapBuilder> = { district: buildDistrict, mexico: buildMexico };
export function buildLevel(
  scene: Scene,
  world: World,
  key = 'district',
  opts: { arena?: boolean } = {},
): Level {
  const mapKey = knownMap(key);
  const level = builders[mapKey](createBuilder(scene, world), !!opts.arena);
  return Object.assign(level, { key: mapKey });
}
