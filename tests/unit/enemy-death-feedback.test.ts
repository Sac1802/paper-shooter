import { expect, it, vi } from 'vitest';
import { Group, Scene, Vector3 } from 'three';
import {
  EnemyDeathFeedback,
  type EnemyDeathEffects,
} from '../../src/presentation/characters/death-feedback.js';
function fixture() {
  const scene = new Scene(),
    effects: EnemyDeathEffects = { debris: vi.fn(), blood: vi.fn(), explosion: vi.fn() },
    audio = { enemyDie: vi.fn(), explosion: vi.fn() };
  return { scene, effects, audio, feedback: new EnemyDeathFeedback(scene, effects, audio) };
}
it('retires the telegraph before showing the dead face and transfers a flying root before registering debris', () => {
  const { scene, effects, feedback } = fixture(),
    face = { eyes: new Group(), xeyes: new Group() };
  face.xeyes.visible = false;
  const telegraph = {
    dispose: vi.fn(() => {
      expect(face.eyes.visible).toBe(true);
    }),
  };
  feedback.begin(face, telegraph);
  expect(telegraph.dispose).toHaveBeenCalledOnce();
  expect(face.eyes.visible).toBe(false);
  expect(face.xeyes.visible).toBe(true);
  const parent = new Group(),
    root = new Group();
  parent.position.x = 4;
  root.position.set(1, 2, 3);
  parent.add(root);
  scene.add(parent);
  const direction = new Vector3(1, 0, 0);
  const transferred = vi.fn(() => {
    expect(root.parent).toBe(scene);
    expect(effects.debris).not.toHaveBeenCalled();
  });
  feedback.flyer(root, new Vector3(), direction, transferred);
  expect(transferred).toHaveBeenCalledOnce();
  expect(root.position.toArray()).toEqual([5, 2, 3]);
  expect(effects.debris).toHaveBeenCalledOnce();
  const call = vi.mocked(effects.debris).mock.calls[0];
  expect(call[0]).toBe(root);
  expect(call[2].toArray().every(Number.isFinite)).toBe(true);
  expect(call[4]).toEqual({ radius: 0.5, blood: true, life: 8 });
  expect(effects.blood).toHaveBeenCalledOnce();
  expect(direction.toArray()).toEqual([1, 0, 0]);
});
it('keeps visual explosion before sound and emits ordinary death sound only when requested', () => {
  const { effects, audio, feedback } = fixture(),
    events: string[] = [];
  vi.mocked(effects.explosion).mockImplementation(() => {
    events.push('visual');
  });
  audio.explosion.mockImplementation(() => {
    events.push('sound');
  });
  feedback.boss(new Vector3());
  expect(events).toEqual(['visual', 'sound']);
  expect(audio.enemyDie).not.toHaveBeenCalled();
  feedback.die(new Vector3());
  expect(audio.enemyDie).toHaveBeenCalledOnce();
});
