import { expect, it, vi } from 'vitest';
import { TYPES } from '../../src/domain/enemies.js';
import { EnemyCombat, type EnemyCombatPorts } from '../../src/gameplay/enemies/combat.js';
function fixture(kind: 'grunt' | 'shield' | 'boss' = 'grunt') {
  const feedback = { hit: vi.fn(), shield: vi.fn(), shieldMarker: vi.fn() },
    ports: EnemyCombatPorts = {
      present: vi.fn(() => true),
      mirror: vi.fn(() => false),
      damageModifier: () => 2,
      feedback,
      clientHit: vi.fn(),
      breakShield: vi.fn(),
      wake: vi.fn(),
      bossChanged: vi.fn(),
      hitstop: vi.fn(),
      kill: vi.fn(),
    };
  const combat = new EnemyCombat(TYPES[kind], ports);
  return { combat, ports, feedback };
}
it('applies authoritative damage scaling while preserving negative HP for overkill classification', () => {
  const { combat, ports, feedback } = fixture();
  combat.damage(10, { source: 'rifle', part: 'torso' });
  expect(combat.hp).toBe(80);
  expect(feedback.hit).toHaveBeenCalledWith(20, expect.any(Object), {
    mirror: false,
    lethal: false,
  });
  expect(ports.wake).toHaveBeenCalledOnce();
  expect(ports.kill).not.toHaveBeenCalled();
  ports.kill = vi.fn(() => {
    combat.alive = false;
  });
  combat.damage(60, { source: 'rifle', crit: true });
  expect(combat.hp).toBe(-40);
  expect(ports.hitstop).toHaveBeenCalledWith(0.05, 0.25);
  expect(ports.kill).toHaveBeenCalledOnce();
  combat.damage(10, { source: 'rifle' });
  expect(combat.hp).toBe(-40);
  expect(ports.kill).toHaveBeenCalledOnce();
});
it('forwards mirror hits without changing host-owned health or shield state', () => {
  const { combat, ports, feedback } = fixture('shield');
  vi.mocked(ports.mirror).mockReturnValue(true);
  combat.damage(1000, { source: 'rifle', part: 'torso' });
  combat.damage(5, { source: 'katana', part: 'shield' });
  expect(combat.hp).toBe(150);
  expect(combat.shieldHp).toBe(2);
  expect(feedback.hit).toHaveBeenCalledExactlyOnceWith(1000, expect.any(Object), {
    mirror: true,
    lethal: false,
  });
  expect(feedback.shield).not.toHaveBeenCalled();
  expect(ports.clientHit).toHaveBeenCalledTimes(2);
  expect(ports.kill).not.toHaveBeenCalled();
});
it('blocks firearm damage with a shield and breaks it only after two existing blade/blast hits', () => {
  const { combat, ports, feedback } = fixture('shield');
  combat.damage(1000, { source: 'rifle', part: 'shield' });
  expect(combat.shieldHp).toBe(2);
  combat.damage(1, { source: 'katana', part: 'shield' });
  expect(combat.shieldHp).toBe(1);
  combat.damage(1, { source: 'blast', part: 'shield' });
  expect(combat.shieldHp).toBe(0);
  expect(combat.hp).toBe(150);
  expect(ports.breakShield).toHaveBeenCalledOnce();
  expect(feedback.shield).toHaveBeenCalledTimes(3);
  expect(feedback.shieldMarker).toHaveBeenCalledTimes(3);
  expect(feedback.hit).not.toHaveBeenCalled();
});
it('ignores stale targets outside the owning population before applying feedback or forwarding', () => {
  const { combat, ports, feedback } = fixture();
  vi.mocked(ports.present).mockReturnValue(false);
  combat.damage(1000, { source: 'rifle' });
  expect(combat.hp).toBe(100);
  expect(feedback.hit).not.toHaveBeenCalled();
  expect(ports.clientHit).not.toHaveBeenCalled();
  expect(ports.kill).not.toHaveBeenCalled();
});
it('notifies boss health after hit/wake feedback and before requesting death', () => {
  const { combat, ports, feedback } = fixture('boss'),
    order: string[] = [];
  feedback.hit.mockImplementation(() => {
    order.push('hit');
  });
  ports.wake = () => {
    order.push('wake');
  };
  ports.bossChanged = () => {
    order.push('boss');
    expect(combat.alive).toBe(true);
    expect(combat.hp).toBeLessThan(0);
  };
  ports.hitstop = () => {
    order.push('hitstop');
  };
  ports.kill = () => {
    order.push('kill');
    combat.alive = false;
  };
  combat.damage(10000, { source: 'rifle' });
  expect(order).toEqual(['hit', 'wake', 'boss', 'hitstop', 'kill']);
});
