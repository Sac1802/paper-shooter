import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { INK } from '../../src/shared/ink.js';
import { makeInkMaterial } from '../../src/presentation/ink/materials.js';
import {
  EnemyHitFeedback,
  type EnemyHitPorts,
} from '../../src/presentation/characters/hit-feedback.js';
function fixture() {
  const material = makeInkMaterial(),
    pose = { center: new Vector3(0, 1, 0), ink: INK.BLACK, boss: true };
  const ports: EnemyHitPorts = {
    effects: { blood: vi.fn(), sparks: vi.fn() },
    audio: { headshot: vi.fn(), hitEnemy: vi.fn(), shieldHit: vi.fn() },
    hud: { hitmarker: vi.fn() },
    input: { rumble: vi.fn() },
  };
  const feedback = new EnemyHitFeedback(material, pose, ports);
  return { material, pose, ports, feedback };
}
it('applies critical feedback and boss blood scaling, then expires its flash while damping flinch', () => {
  const { feedback, material, pose, ports } = fixture();
  feedback.hit(70, { source: 'rifle', crit: true }, { mirror: false, lethal: false });
  expect(ports.effects.blood).toHaveBeenCalledWith(
    pose.center,
    expect.any(Vector3),
    expect.any(Number),
    {
      ink: INK.BLACK,
    },
  );
  expect(vi.mocked(ports.effects.blood).mock.calls[0][2]).toBeCloseTo(2.4);
  expect(ports.audio.headshot).toHaveBeenCalledOnce();
  expect(ports.hud.hitmarker).toHaveBeenCalledWith(false, true);
  expect(ports.input.rumble).toHaveBeenCalledOnce();
  expect(feedback.amount).toBe(1);
  expect(material.uniforms.uFill.value).toBe(1);
  feedback.update(0.05);
  expect(material.uniforms.uFill.value).toBe(1);
  expect(feedback.amount).toBeLessThan(1);
  feedback.update(0.03);
  expect(material.uniforms.uFill.value).toBe(0);
});
it('reports mirrored feedback without boss blood amplification, sound, rumble or local kill credit', () => {
  const { feedback, ports, pose } = fixture();
  feedback.hit(70, { source: 'rifle', crit: false }, { mirror: true, lethal: true });
  expect(ports.effects.blood).toHaveBeenCalledWith(pose.center, expect.any(Vector3), 1.5, {
    ink: INK.BLACK,
  });
  expect(ports.audio.headshot).not.toHaveBeenCalled();
  expect(ports.audio.hitEnemy).not.toHaveBeenCalled();
  expect(ports.input.rumble).not.toHaveBeenCalled();
  expect(ports.hud.hitmarker).toHaveBeenCalledWith(false, false);
});
it('keeps fuse flashes independent of flinch and shield sparks independent of both', () => {
  const { feedback, material, ports, pose } = fixture();
  feedback.flash(0.02);
  expect(feedback.amount).toBe(0);
  feedback.update(0.02);
  expect(material.uniforms.uFill.value).toBe(0);
  const direction = new Vector3(0, 0, -1);
  feedback.shield({ source: 'katana', part: 'shield', dir: direction });
  expect(ports.effects.sparks).toHaveBeenCalledWith(
    pose.center,
    expect.any(Vector3),
    INK.ORANGE,
    8,
    8,
  );
  expect(vi.mocked(ports.effects.sparks).mock.calls[0][1].equals(new Vector3(0, 0, 1))).toBe(true);
  expect(vi.mocked(ports.effects.sparks).mock.calls[0][1]).not.toBe(direction);
  expect(direction.toArray()).toEqual([0, 0, -1]);
  expect(feedback.amount).toBe(0);
  feedback.shieldMarker();
  expect(ports.hud.hitmarker).toHaveBeenCalledWith(false, false);
  feedback.nudge();
  expect(feedback.amount).toBe(1);
});
it('preserves the deflected-hit rumble exception while showing a lethal ordinary hit', () => {
  const { feedback, ports } = fixture();
  feedback.hit(10, { source: 'deflect', crit: false }, { mirror: false, lethal: true });
  expect(ports.audio.hitEnemy).toHaveBeenCalledOnce();
  expect(ports.input.rumble).not.toHaveBeenCalled();
  expect(ports.hud.hitmarker).toHaveBeenCalledWith(true, false);
});
