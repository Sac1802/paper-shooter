import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import {
  NetworkCombatFeedback,
  type NetworkCombatFeedbackPorts,
} from '../../src/presentation/network-combat-feedback.js';
it('projects parry and rope feedback without changing actor vectors', () => {
  const eye = new Vector3(1, 2, 3),
    center = new Vector3(1, 1, 3),
    forward = new Vector3(0, 0, -1);
  const events: unknown[] = [];
  const record = (name: string) =>
    vi.fn((...args: unknown[]) => {
      events.push([name, ...args]);
    });
  const burst = vi.fn((point: Vector3, ...args: unknown[]) => {
    events.push(['burst', point.toArray(), ...args]);
  });
  const ports: NetworkCombatFeedbackPorts = {
    player: { eye, center, forward },
    opponents: new Map(),
    effects: { strokeBurst: burst, tracer: vi.fn() },
    audio: { shieldHit: record('sound'), remoteShot: vi.fn() },
    input: { rumble: record('rumble') },
    hud: { kill: record('feed'), tip: record('tip') },
  };
  const owner = new NetworkCombatFeedback(ports);
  owner.parry(true);
  owner.cut();
  expect(events).toEqual([
    ['sound', center],
    ['rumble', 0.35, 0.3, 60],
    ['burst', [1, 2, 2.5], 3, 8, 5, { life: 0.2, size: 0.03 }],
    ['feed', 'RETURN TO SENDER', 25],
    ['burst', [1, 1, 3], 3, 8, 4, { life: 0.25, size: 0.03 }],
    ['tip', 'your rope got cut', 1.3],
    ['rumble', 0.5, 0.3, 80],
  ]);
  expect(eye.toArray()).toEqual([1, 2, 3]);
  expect(forward.toArray()).toEqual([0, 0, -1]);
});
