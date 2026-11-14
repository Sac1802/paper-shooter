import * as THREE from 'three';
import { bx, sph } from './character-kit.js';
export function doodleFace(
  headG: THREE.Object3D,
  solid: THREE.Material,
  opts: { ex?: number; ey?: number; ez?: number; er?: number; smile?: boolean } = {},
) {
  const eyes = new THREE.Group();
  headG.add(eyes);
  const ex = opts.ex ?? 0.1,
    ey = opts.ey ?? 0.03,
    ez = opts.ez ?? 0.25,
    er = opts.er ?? 0.045;
  for (const sx of [-1, 1]) {
    const e = sph(er, [sx * ex, ey, ez], solid, eyes, 6);
    e.scale.set(0.85, 1.15, 0.7);
    const b = bx([0.115, 0.026, 0.026], [sx * ex, ey + 0.11, ez - 0.01], solid, eyes);
    b.rotation.z = sx * -0.5;
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 4, 9, Math.PI * 0.9), solid);
  mouth.position.set(0, ey - 0.16, ez - 0.02);
  mouth.rotation.z = opts.smile ? Math.PI : 0;
  eyes.add(mouth);
  const xeyes = new THREE.Group();
  headG.add(xeyes);
  xeyes.visible = false;
  for (const sx of [-1, 1])
    for (const a of [0.8, -0.8]) {
      const c = bx([0.13, 0.024, 0.024], [sx * ex, ey, ez], solid, xeyes);
      c.rotation.z = a;
    }
  const o = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 4, 9), solid);
  o.position.set(0, ey - 0.17, ez - 0.02);
  xeyes.add(o);
  return { eyes, xeyes };
}
