import * as THREE from 'three';
import { rand } from '../../engine/math.js';
import type { Triple } from './weapon-contracts.js';
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export function bx(
  [w, h, d]: Triple,
  [x, y, z]: Triple,
  mat: THREE.Material,
  parent: THREE.Object3D,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function sph(
  r: number,
  [x, y, z]: Triple,
  mat: THREE.Material,
  parent: THREE.Object3D,
  seg = 8,
) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function blob(
  [rx, ry, rz]: Triple,
  [x, y, z]: Triple,
  mat: THREE.Material,
  parent: THREE.Object3D,
) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function noodle(
  [len, r]: [number, number],
  mat: THREE.Material,
  parent: THREE.Object3D,
  [x, y, z]: Triple,
  bow = 0.05,
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const c = new THREE.QuadraticBezierCurve3(
    V3(0, 0, 0),
    V3(rand(-bow, bow), -len * 0.5, rand(-bow, bow) + bow * 0.6),
    V3(0, -len, 0),
  );
  g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 5, r, 6, false), mat));
  const mid = new THREE.Object3D();
  mid.position.y = -len * 0.55;
  g.add(mid);
  g.userData.mid = mid;
  g.userData.len = len;
  return Object.assign(g, { mid });
}
export function mitten(r: number, mat: THREE.Material, parent: THREE.Object3D, y: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
  m.position.y = y;
  m.scale.set(1, 1.15, 0.8);
  parent.add(m);
  return m;
}
export function shoe(mat: THREE.Material, parent: THREE.Object3D, y: number, s = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 7, 5), mat);
  m.position.set(0, y, 0.06 * s);
  m.scale.set(1, 0.62, 1.9);
  parent.add(m);
  return m;
}
