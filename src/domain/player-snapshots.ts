interface Vector {
  x: number;
  y: number;
  z: number;
}
export interface LocalSnapshotSource {
  body: { pos: Vector; vel: Vector; onGround: boolean };
  grapple?: { state: string; hook: Vector } | null;
  yaw: number;
  pitch: number;
  crouching: boolean;
  sliding: boolean;
  isBlocking: boolean;
  _aiming: boolean;
  alive: boolean;
  parryWindow: boolean;
  hp: number;
}
export interface LocalSnapshotFlags {
  firing?: boolean;
  idle?: boolean;
  untouched?: boolean;
  away?: boolean;
}
/** Existing eleven-number player wire format; an active grapple appends its three-number hook. */
export function encodeLocal(
  player: LocalSnapshotSource,
  weaponIndex: number,
  extra: LocalSnapshotFlags = {},
): number[] {
  const body = player.body;
  const grapple = player.grapple;
  const grappling = grapple && grapple.state !== 'idle';
  const out = [
    +body.pos.x.toFixed(2),
    +body.pos.y.toFixed(2),
    +body.pos.z.toFixed(2),
    +player.yaw.toFixed(2),
    +player.pitch.toFixed(2),
    weaponIndex,
    (player.crouching ? 1 : 0) |
      (player.sliding ? 2 : 0) |
      (player.isBlocking ? 4 : 0) |
      (player._aiming ? 8 : 0) |
      (body.onGround ? 16 : 0) |
      (extra.firing ? 32 : 0) |
      (player.alive ? 64 : 0) |
      (grappling ? 128 : 0) |
      (player.parryWindow ? 256 : 0) |
      (extra.idle ? 512 : 0) |
      (extra.untouched ? 1024 : 0) |
      (extra.away ? 2048 : 0),
    Math.round(player.hp),
    +body.vel.x.toFixed(1),
    +body.vel.y.toFixed(1),
    +body.vel.z.toFixed(1),
  ];
  if (grappling)
    out.push(+grapple.hook.x.toFixed(1), +grapple.hook.y.toFixed(1), +grapple.hook.z.toFixed(1));
  return out;
}
