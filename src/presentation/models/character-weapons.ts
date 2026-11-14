import * as THREE from 'three';
import { makeInkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
import { bx } from './character-kit.js';
import type { CharacterAppearance } from './character-contracts.js';
export function buildWeaponProp(
  gun: THREE.Object3D,
  mat: THREE.Material,
  solid: THREE.Material,
  T: Pick<CharacterAppearance, 'weapon'>,
) {
  if (T.weapon === 'blade') {
    bx([0.02, 0.05, 0.95], [0, 0.04, 0.42], mat, gun);
    bx([0.11, 0.11, 0.03], [0, 0.04, -0.06], solid, gun);
    bx([0.035, 0.045, 0.24], [0, 0.04, -0.19], solid, gun);
  } else if (T.weapon === 'shotgun') {
    bx([0.1, 0.13, 0.66], [0, 0.02, 0.2], mat, gun);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), solid);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.08, 0.5);
    gun.add(b);
  } else if (T.weapon === 'sniper') {
    bx([0.075, 0.11, 0.6], [0, 0.02, 0.15], mat, gun);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6), solid);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.05, 0.72);
    gun.add(b);
    bx([0.06, 0.07, 0.22], [0, 0.13, 0.06], solid, gun);
  } else if (T.weapon === 'pistol') {
    bx([0.055, 0.09, 0.3], [0, 0.03, 0.13], mat, gun);
    bx([0.045, 0.11, 0.055], [0, -0.05, 0], solid, gun);
  } else if (T.weapon === 'boss') {
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 2.4, 7),
      makeInkMaterial({ ink: INK.ORANGE, shadeScale: 0, shadeBias: 1 }),
    );
    pen.position.y = 0.7;
    gun.add(pen);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 6), solid);
    tip.position.y = 2.08;
    gun.add(tip);
    const er = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8),
      makeInkMaterial({ ink: INK.PINK, shadeScale: 0, shadeBias: 1 }),
    );
    er.position.y = -0.62;
    gun.add(er);
  } else {
    bx([0.085, 0.12, 0.5], [0, 0.02, 0.16], mat, gun);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6), solid);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.05, 0.52);
    gun.add(b);
    bx([0.05, 0.16, 0.09], [0, -0.09, 0.08], mat, gun);
  }
}
