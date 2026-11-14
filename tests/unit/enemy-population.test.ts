import { expect, it, vi } from 'vitest';
import { EnemyPopulation } from '../../src/gameplay/enemies/population.js';
const enemy = (id: number, type = 'grunt') => ({ id, type, alive: true, state: 'hunt', deadT: 0 });
it('keeps membership, ID lookup and live counts consistent through repeated death and corpse retirement', () => {
  const population = new EnemyPopulation<ReturnType<typeof enemy>>();
  const first = enemy(population.allocateId()),
    second = enemy(population.allocateId(), 'bomber');
  population.add(first);
  population.add(second);
  expect(population.alive).toBe(2);
  expect(population.count('bomber')).toBe(1);
  expect(population.byId.get(first.id)).toBe(first);
  expect(population.markDead(first)).toBe(true);
  expect(population.markDead(first)).toBe(false);
  expect(population.alive).toBe(1);
  expect(first.state).toBe('dead');
  expect(population.entries).toEqual([first, second]);
  const release = vi.fn();
  first.deadT = 9;
  population.retire(9, release);
  expect(release).not.toHaveBeenCalled();
  first.deadT = 9.1;
  population.retire(9, release);
  population.retire(9, release);
  expect(release).toHaveBeenCalledExactlyOnceWith(first);
  expect(population.byId.has(first.id)).toBe(false);
  expect(population.entries).toEqual([second]);
  expect(population.alive).toBe(1);
});
it('shares a monotonic allocator with projectile consumers and preserves it across a match clear', () => {
  const population = new EnemyPopulation<ReturnType<typeof enemy>>(),
    first = enemy(population.allocateId());
  population.add(first);
  const projectileId = population.allocateId(),
    second = enemy(population.allocateId());
  population.add(second);
  expect([first.id, projectileId, second.id]).toEqual([1, 2, 3]);
  const release = vi.fn();
  population.clear(release);
  population.clear(release);
  expect(release.mock.calls.map(([entity]) => entity)).toEqual([first, second]);
  expect(population.alive).toBe(0);
  expect(population.entries).toHaveLength(0);
  expect(population.byId.size).toBe(0);
  expect(population.allocateId()).toBe(4);
  expect(population.markDead(first)).toBe(false);
  expect(population.alive).toBe(0);
});
it('releases expired entities in reverse order while retaining living and younger bodies', () => {
  const population = new EnemyPopulation<ReturnType<typeof enemy>>(),
    entities = [enemy(1), enemy(2), enemy(3)];
  for (const entity of entities) population.add(entity);
  for (const entity of entities.slice(0, 2)) {
    population.markDead(entity);
    entity.deadT = 10;
  }
  const release = vi.fn((entity: ReturnType<typeof enemy>) => {
    expect(population.byId.get(entity.id)).toBe(entity);
  });
  population.retire(9, release);
  expect(release.mock.calls.map(([entity]) => entity.id)).toEqual([2, 1]);
  expect(population.entries).toEqual([entities[2]]);
});
