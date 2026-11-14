/** Existing compact enemy replica format; it is not a new transport message. */
export type EnemySnapshot = [
  id: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  state: number,
  hp: number,
  aim: number,
  attack: number,
  fuse: 0 | 1,
  boss: 0 | 1,
];
