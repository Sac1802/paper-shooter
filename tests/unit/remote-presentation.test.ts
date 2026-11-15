import { expect, it } from 'vitest';
import { Scene, Vector3, Group, MeshBasicMaterial } from 'three';
import { SceneResources } from '../../src/engine/resources.js';
import { RemoteGrapple } from '../../src/presentation/remote-grapple.js';
import {
  RemoteAnimation,
  remoteAnimationFrame,
} from '../../src/presentation/characters/remote-animation.js';
import { buildHumanoid } from '../../src/presentation/models/humanoid.js';
it('projects and retires remote ropes independently without changing borrowed endpoints', () => {
  const scene = new Scene(),
    resources = new SceneResources();
  const first = new RemoteGrapple(scene, resources),
    second = new RemoteGrapple(scene, resources);
  const position = new Vector3(1, 0, 2),
    right = new Vector3(1, 0, 0),
    point = new Vector3(5, 6, 7);
  first.update(true, position, right, point);
  expect(first.rope.visible).toBe(true);
  expect(first.hook.position).toEqual(point);
  expect(first.rope.scale.y).toBeCloseTo(point.distanceTo(new Vector3(1.35, 1.25, 2)));
  expect(point).toEqual(new Vector3(5, 6, 7));
  second.update(true, new Vector3(), right, new Vector3(0, 4, 0));
  const secondPosition = second.rope.position.clone();
  first.hide();
  expect(first.hook.visible).toBe(false);
  first.dispose();
  expect(second.rope.position).toEqual(secondPosition);
  expect(second.rope.parent).toBe(scene);
  second.dispose();
  expect(resources.resourceCount).toBe(0);
});
it('owns remote guard, airborne and slumped poses while leaving the borrowed frame unchanged', () => {
  const resources = new SceneResources();
  const model = buildHumanoid(new MeshBasicMaterial(), new MeshBasicMaterial(), {
    weapon: 'rifle',
    scale: 1,
  });
  resources.track(model.root);
  try {
    const rig = { root: model.root, joints: model.J, face: model.face, tag: new Group() };
    const frame = remoteAnimationFrame(new Vector3(0, 1, 8), new Vector3());
    frame.onGround = false;
    frame.blade = true;
    frame.blocking = true;
    frame.localEye = new Vector3(3, 2, 5);
    const before = JSON.stringify(frame);
    const animation = new RemoteAnimation();
    animation.update(frame, rig, 0.1);
    expect(JSON.stringify(frame)).toBe(before);
    expect(model.J.legL.rotation.x).toBe(-0.5);
    expect(model.J.armR.rotation.z).toBe(-0.8);
    expect(model.face.eyes.visible).toBe(true);
    frame.alive = false;
    const tag = rig.tag.rotation.y;
    animation.update(frame, rig, 0.1);
    expect(model.face.xeyes.visible).toBe(true);
    expect(model.root.rotation.x).toBeGreaterThan(0);
    expect(rig.tag.rotation.y).toBe(tag);
  } finally {
    resources.dispose();
  }
});
