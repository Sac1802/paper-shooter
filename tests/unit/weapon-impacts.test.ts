import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { World } from '../../src/engine/physics.js';
import { Hitscan } from '../../src/gameplay/weapons/hitscan.js';
import { MeleeImpacts } from '../../src/gameplay/weapons/melee-impacts.js';
import type {
  HitscanPorts,
  MeleeImpactPorts,
  GunImpactSpec,
} from '../../src/gameplay/weapons/impact-contracts.js';
afterEach(() => vi.restoreAllMocks());
const spec: GunImpactSpec = {
  kind: 'rifle',
  damage: 24,
  headMul: 2,
  falloff: null,
  pvp: [10, 3, null],
  tracer: 0.02,
};
const origin = new Vector3(),
  direction = new Vector3(0, 0, -1);
function hitscanFixture() {
  const events: string[] = [];
  const ports: HitscanPorts<string, string> = {
    world: { raycast: vi.fn(() => null) },
    enemies: {
      raycast: vi.fn(() => null),
      damage: vi.fn(() => {
        events.push('enemy');
      }),
    },
    players: {
      raycast: vi.fn(() => null),
      damage: vi.fn(() => {
        events.push('player');
      }),
    },
    breakableHit: vi.fn(() => false),
    feedback: {
      tracer: vi.fn(() => {
        events.push('tracer');
      }),
      bulletImpact: vi.fn(),
      ricochet: vi.fn(),
      shot: vi.fn(() => {
        events.push('shot');
      }),
    },
  };
  const muzzle = vi.fn((out: Vector3) => {
    events.push('muzzle');
    out.set(1, 2, 3);
  });
  return { ports, muzzle, events, hitscan: new Hitscan(ports) };
}
describe('weapon impact policy', () => {
  it('applies PvP critical values before sampling the muzzle and publishing its tracer', () => {
    const f = hitscanFixture();
    const point = new Vector3(0, 0, -5);
    vi.mocked(f.ports.players.raycast).mockReturnValue({
      player: 'guest',
      point,
      dist: 5,
      part: 'head',
    });
    expect(f.hitscan.fire(spec, origin, direction, f.muzzle)).toBe(true);
    expect(f.ports.players.damage).toHaveBeenCalledWith(
      'guest',
      30,
      expect.objectContaining({ crit: true, source: 'rifle', point, dist: 5 }),
    );
    expect(f.events).toEqual(['player', 'muzzle', 'tracer', 'shot']);
    expect(f.ports.enemies.damage).not.toHaveBeenCalled();
    expect(f.ports.feedback.tracer).toHaveBeenCalledWith(
      new Vector3(1, 2, 3),
      point,
      expect.any(Number),
      0.02,
      0.05,
    );
    f.hitscan.fire({ ...spec, pvp: undefined }, origin, direction, f.muzzle);
    expect(f.ports.players.damage).toHaveBeenLastCalledWith('guest', 48, expect.any(Object));
  });
  it('breaks a nearer prop but preserves wall impact and ricochet draws for an enemy/wall tie', () => {
    const f = hitscanFixture();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const box = new World().addBox(new Vector3(-1, -1, -1), new Vector3(1, 1, 1), {
      breakable: { id: 7 },
    });
    const wall = { box, dist: 3, point: new Vector3(0, 0, -3), normal: new Vector3(0, 0, 1) };
    vi.mocked(f.ports.world.raycast).mockReturnValue(wall);
    vi.mocked(f.ports.breakableHit).mockReturnValue(true);
    expect(f.hitscan.fire(spec, origin, direction, f.muzzle)).toBe(true);
    expect(f.ports.breakableHit).toHaveBeenCalledOnce();
    expect(random).not.toHaveBeenCalled();
    vi.mocked(f.ports.enemies.raycast).mockReturnValue({
      enemy: 'bot',
      point: wall.point,
      part: 'torso',
      dist: 3,
    });
    expect(f.hitscan.fire(spec, origin, direction, f.muzzle)).toBe(false);
    expect(f.ports.breakableHit).toHaveBeenCalledTimes(1);
    expect(f.ports.enemies.damage).not.toHaveBeenCalled();
    expect(f.ports.feedback.bulletImpact).toHaveBeenCalledOnce();
    expect(f.ports.feedback.ricochet).toHaveBeenCalledOnce();
    expect(random).toHaveBeenCalledOnce();
  });
  it('applies enemy falloff and publishes the bounded miss endpoint without changing borrowed vectors', () => {
    const f = hitscanFixture();
    vi.mocked(f.ports.enemies.raycast).mockReturnValue({
      enemy: 'bot',
      point: new Vector3(0, 0, -20),
      part: 'head',
      dist: 20,
    });
    f.hitscan.fire({ ...spec, falloff: [10, 30, 0.2] }, origin, direction, f.muzzle);
    expect(f.ports.enemies.damage).toHaveBeenCalledWith(
      'bot',
      24,
      expect.objectContaining({ crit: true }),
    );
    vi.mocked(f.ports.enemies.raycast).mockReturnValue(null);
    expect(f.hitscan.fire(spec, origin, direction, f.muzzle)).toBe(false);
    expect(f.ports.feedback.shot).toHaveBeenLastCalledWith(new Vector3(0, 0, -300));
    expect(origin).toEqual(new Vector3());
    expect(direction).toEqual(new Vector3(0, 0, -1));
  });
  it('orders blade enemy, player, rope and prop commands and gives each hit its own vectors', () => {
    const events: string[] = [];
    const enemy = { center: new Vector3(1, 1, 1) },
      player = { center: new Vector3(2, 2, 2) },
      prop = { id: 7, pos: new Vector3(3, 3, 3) };
    const ports: MeleeImpactPorts<typeof enemy, typeof player> = {
      enemies: {
        inArc: () => [{ enemy }],
        damage: vi.fn(() => {
          events.push('enemy');
        }),
      },
      players: {
        inArc: () => [player],
        damage: vi.fn(() => {
          events.push('player');
        }),
      },
      ropes: {
        cut: vi.fn(() => {
          events.push('rope');
          return true;
        }),
      },
      props: {
        inArc: () => [prop],
        damage: vi.fn(() => {
          events.push('prop');
        }),
      },
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const impacts = new MeleeImpacts(ports);
    expect(impacts.strike(origin, direction, direction, -1, 80)).toBe(true);
    expect(events).toEqual(['enemy', 'player', 'rope', 'prop']);
    const enemyImpact = vi.mocked(ports.enemies.damage).mock.calls[0][2];
    expect(enemyImpact).toMatchObject({ source: 'katana', crit: false, slashDir: -1 });
    expect(enemyImpact.point).not.toBe(enemy.center);
    expect(enemyImpact.dir).not.toBe(direction);
    expect(ports.players.damage).toHaveBeenCalledWith(player, 55, expect.any(Object));
    expect(enemy.center).toEqual(new Vector3(1, 1, 1));
    ports.enemies.inArc = () => [];
    ports.players.inArc = () => [];
    ports.props.inArc = () => [];
    vi.mocked(ports.ropes.cut).mockReturnValue(false);
    expect(impacts.strike(origin, direction, direction, 1, 80)).toBe(false);
  });
});
