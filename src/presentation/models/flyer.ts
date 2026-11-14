import * as THREE from 'three';
import type { CharacterAppearance, CharacterHit } from './character-contracts.js';
import { bx } from './character-kit.js';
import { doodleFace } from './character-face.js';
export function buildFlyer(mat: THREE.Material, solid: THREE.Material, T: CharacterAppearance) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.6;
  root.add(body);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.25, 3), mat);
  cone.rotation.x = Math.PI / 2;
  cone.position.z = 0.08;
  body.add(cone);
  const torsoPoint = new THREE.Object3D();
  body.add(torsoPoint);
  const headPoint = torsoPoint;
  const wl = bx([0.86, 0.025, 0.5], [-0.48, 0.04, -0.14], mat, body),
    wr = bx([0.86, 0.025, 0.5], [0.48, 0.04, -0.14], mat, body);
  const headG = new THREE.Group();
  headG.position.set(0, -0.06, 0.3);
  headG.scale.setScalar(0.72);
  body.add(headG);
  const fc = doodleFace(headG, solid, { ex: 0.11, ey: 0.02, ez: 0.16, er: 0.05 });
  bx([0.04, 0.28, 0.3], [0, 0.14, -0.62], mat, body);
  const J = { body, wl, wr, headG, torso: body, gun: new THREE.Group() };
  root.scale.setScalar(T.scale);
  return {
    root,
    parts: { torso: torsoPoint, head: headPoint },
    J,
    tip: headG,
    face: fc,
    hit: [['torso', 0.48]] satisfies CharacterHit[],
  };
}
