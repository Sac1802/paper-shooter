import { expect, it, vi } from 'vitest';
import { Group, Vector3 } from 'three';
import { World } from '../../src/engine/physics.js';
import {
  PropCombat,
  type Breakable,
  type PropCombatPorts,
} from '../../src/gameplay/combat/props.js';
function prop(id = 0, kind = 'crate'): Breakable {
  const box = new World().addBox(new Vector3(-1, 0, -1), new Vector3(1, 2, 1));
  return {
    id,
    kind,
    box,
    alive: true,
    hp: 50,
    group: new Group(),
    pos: new Vector3(0, 0, -3),
    ink: 2,
  };
}
function fixture(kind = 'crate') {
  const events: string[] = [];
  const event = (name: string) =>
    vi.fn((..._args: unknown[]) => {
      events.push(name);
    });
  const first = prop(0, kind);
  let collection = [first];
  const ports: PropCombatPorts = {
    props: () => collection,
    lookup: (id) => collection.find((item) => item.id === id),
    world: { removeBox: event('remove') },
    feedback: {
      hit: event('hit'),
      discard: event('discard'),
      shatter: event('shatter'),
      finish: event('finish'),
    },
    canDrop: vi.fn(() => true),
    dropHealth: event('drop'),
    solo: vi.fn(() => true),
    score: event('score'),
    broken: event('broken'),
  };
  return {
    first,
    ports,
    events,
    combat: new PropCombat(ports),
    replace: (items: Breakable[]) => {
      collection = items;
    },
  };
}
it('accepts only current prop handles and follows collection replacement', () => {
  const f = fixture(),
    point = new Vector3(),
    direction = new Vector3(0, 0, -1);
  f.combat.damage(f.first, 10, point, direction);
  expect(f.first.hp).toBe(40);
  expect(f.ports.feedback.hit).toHaveBeenCalledWith(point, f.first.ink);
  f.combat.damage({ id: f.first.id }, 10, point, direction);
  expect(f.first.hp).toBe(40);
  const replacement = prop();
  f.replace([replacement]);
  f.combat.damage(f.first, 10, point, direction);
  expect(f.first.hp).toBe(40);
  f.combat.damage(replacement, 1, point, direction);
  expect(replacement.hp).toBe(49);
});
it('orders piñata removal, visual transfer, loot, score, sound and replication exactly once', () => {
  const f = fixture('pinata');
  f.combat.break(f.first, null, true);
  expect(f.events).toEqual(['remove', 'shatter', 'drop', 'drop', 'score', 'finish', 'broken']);
  expect(f.first.alive).toBe(false);
  expect(f.ports.score).toHaveBeenCalledWith(25, 'PIÑATA');
  f.combat.break(f.first, null, true);
  expect(f.ports.world.removeBox).toHaveBeenCalledOnce();
});
it('keeps quiet retirement and non-authoritative breaks free of loot or broadcast', () => {
  const f = fixture('pinata');
  f.combat.break(f.first, null, true, true);
  expect(f.events).toEqual(['remove', 'discard']);
  const other = prop(1, 'pinata');
  f.replace([other]);
  vi.mocked(f.ports.canDrop).mockReturnValue(false);
  vi.mocked(f.ports.solo).mockReturnValue(false);
  f.events.length = 0;
  f.combat.break(other, null, false);
  expect(f.events).toEqual(['remove', 'shatter', 'finish']);
});
it('queries live props by arc and applies blast reach without moving source positions', () => {
  const f = fixture(),
    behind = prop(1),
    far = prop(2);
  behind.pos.z = 3;
  far.pos.z = -30;
  f.replace([f.first, behind, far]);
  expect(f.combat.inArc(new Vector3(), new Vector3(0, 0, -1), 5, 0.7)).toEqual([f.first]);
  f.combat.blast(new Vector3(0, 0, -3), 2);
  expect(f.first.alive).toBe(false);
  expect(behind.alive).toBe(true);
  expect(f.combat.inArc(new Vector3(), new Vector3(0, 0, -1), 5, 0.7)).toEqual([]);
  expect(f.first.pos).toEqual(new Vector3(0, 0, -3));
});
