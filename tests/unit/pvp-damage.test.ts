import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { PvpDamage, type PvpDamagePorts } from '../../src/gameplay/combat/pvp-damage.js';
import type { WeaponImpact } from '../../src/gameplay/weapons/impact-contracts.js';
afterEach(() => vi.restoreAllMocks());
function fixture() {
  const events: string[] = [];
  const event = (name: string) =>
    vi.fn((..._args: unknown[]) => {
      events.push(name);
    });
  const target = {
    id: 'guest',
    alive: true,
    center: new Vector3(0, 0, -2),
    forward: new Vector3(0, 0, 1),
    blocking: false,
    parryWindow: false,
    flash: event('flash'),
  };
  const ports: PvpDamagePorts<typeof target> = {
    canHurt: vi.fn(() => true),
    local: {
      center: new Vector3(),
      eye: new Vector3(0, 1.6, 0),
      lastHitBy: null,
      lastHit: null,
      takeDamage: event('local-damage'),
    },
    effects: { strokeBurst: event('stroke'), tracer: event('tracer'), blood: event('blood') },
    audio: { shieldHit: event('shield'), hitEnemy: event('hit') },
    hud: { tip: event('tip'), hitmarker: event('marker') },
    rumble: event('rumble'),
    postponeMelee: event('postpone'),
    hitstop: event('hitstop'),
    reportGuard: event('guard-report'),
    reportDamage: event('damage-report'),
  };
  const impact: WeaponImpact = {
    point: target.center.clone(),
    dir: new Vector3(0, 0, -1),
    part: 'head',
    source: 'rifle',
    crit: true,
  };
  return { target, ports, impact, events, damage: new PvpDamage(ports) };
}
it('publishes eligible body hit feedback before reporting damage to its owner', () => {
  const f = fixture();
  f.damage.hit(f.target, 25.7, f.impact);
  expect(f.events).toEqual(['blood', 'marker', 'hit', 'flash', 'damage-report']);
  expect(f.ports.reportDamage).toHaveBeenCalledWith(
    'guest',
    25.7,
    f.ports.local.center,
    true,
    'rifle',
  );
  expect(f.ports.local.takeDamage).not.toHaveBeenCalled();
});
it('records a returned blade hit before local damage and reports the guard outcome last', () => {
  const f = fixture();
  vi.spyOn(Math, 'random').mockReturnValue(0.2);
  f.damage.hit(f.target, 50, { ...f.impact, part: 'blade' });
  expect(f.events).toEqual([
    'stroke',
    'shield',
    'tracer',
    'tip',
    'rumble',
    'local-damage',
    'guard-report',
  ]);
  expect(f.ports.local.lastHitBy).toBe('guest');
  expect(f.ports.local.lastHit).toEqual({
    from: [0, 0, -2],
    amount: 30,
    crit: false,
    src: 'deflect',
  });
  expect(f.ports.local.takeDamage).toHaveBeenCalledWith(30, f.target.center);
  expect(f.ports.reportGuard).toHaveBeenCalledWith('guest', true);
  expect(f.ports.reportDamage).not.toHaveBeenCalled();
});
it('deflects a blade contact without damaging the local player when no return is selected', () => {
  const f = fixture();
  vi.spyOn(Math, 'random').mockReturnValue(0.8);
  f.damage.hit(f.target, 50, { ...f.impact, part: 'blade' });
  expect(f.ports.hud.tip).toHaveBeenCalledWith('DEFLECTED', 0.7);
  expect(f.ports.local.takeDamage).not.toHaveBeenCalled();
  expect(f.ports.reportGuard).toHaveBeenCalledWith('guest', false);
});
it('parries front-facing slashes within the guard window and lets rear hits through', () => {
  const f = fixture();
  f.target.blocking = f.target.parryWindow = true;
  const slash = { ...f.impact, part: 'torso', source: 'katana' };
  f.damage.hit(f.target, 55, slash);
  expect(f.events).toEqual(['stroke', 'shield', 'hitstop', 'postpone', 'rumble', 'tip']);
  expect(f.ports.postponeMelee).toHaveBeenCalledWith(0.6);
  expect(f.ports.reportDamage).not.toHaveBeenCalled();
  f.target.forward.z = -1;
  f.damage.hit(f.target, 55, slash);
  expect(f.ports.reportDamage).toHaveBeenCalledOnce();
});
it('rejects dead and ineligible opponents before producing any effects', () => {
  const f = fixture();
  vi.mocked(f.ports.canHurt).mockReturnValue(false);
  f.damage.hit(f.target, 50, f.impact);
  vi.mocked(f.ports.canHurt).mockReturnValue(true);
  f.target.alive = false;
  f.damage.hit(f.target, 50, f.impact);
  expect(f.events).toEqual([]);
});
