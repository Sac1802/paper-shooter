import * as THREE from 'three';
import type { CharacterAppearance, CharacterHit } from './character-contracts.js';
import { bx, blob, noodle, mitten, shoe } from './character-kit.js';
import { doodleFace } from './character-face.js';
import { TAU } from '../../engine/math.js';
import { makeInkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export function buildBomber(
  mat: THREE.Material,
  solid: THREE.Material,
  T: CharacterAppearance,
  boss = false,
) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.5;
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  blob([0.44, 0.44, 0.44], [0, 0.32, 0], mat, torso);
  const torsoPoint = new THREE.Object3D();
  torsoPoint.position.y = 0.32;
  torso.add(torsoPoint);
  const headPoint = torsoPoint;
  const headG = new THREE.Group();
  headG.position.y = 0.32;
  torso.add(headG);
  const fc = doodleFace(headG, solid, { ex: 0.13, ey: 0.1, ez: 0.38, er: 0.06 });
  let spark: THREE.Mesh | null = null;
  if (!boss) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.14, 7), mat);
    cap.position.y = 0.76;
    torso.add(cap);
    const fuse = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.QuadraticBezierCurve3(V3(0, 0.8, 0), V3(0.16, 1.0, 0), V3(0.24, 1.14, 0)),
        5,
        0.02,
        5,
        false,
      ),
      solid,
    );
    torso.add(fuse);
    spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 6, 5),
      makeInkMaterial({ ink: INK.ORANGE, fill: true }),
    );
    spark.position.set(0.24, 1.14, 0);
    torso.add(spark);
  } else if (T.bossKind === 'inkblot') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 5), mat);
      sp.position.set(Math.cos(a) * 0.42, 0.32 + Math.sin(a * 2.3) * 0.25, Math.sin(a) * 0.42);
      sp.lookAt(Math.cos(a) * 3, 0.32, Math.sin(a) * 3);
      sp.rotateX(Math.PI / 2);
      torso.add(sp);
    }
  } else {
    // a chunky rubber block on top: the eraser wears its own head
    bx([0.7, 0.32, 0.5], [0, 0.86, 0], mat, torso);
    bx([0.74, 0.05, 0.54], [0, 0.7, 0], solid, torso);
  }
  const armL = noodle([0.26, 0.03], mat, torso, [-0.42, 0.42, 0]),
    armR = noodle([0.26, 0.03], mat, torso, [0.42, 0.42, 0]);
  mitten(0.07, mat, armL, -0.26);
  mitten(0.07, mat, armR, -0.26);
  const legL = noodle([0.26, 0.035], mat, hips, [-0.16, -0.06, 0]),
    legR = noodle([0.26, 0.035], mat, hips, [0.16, -0.06, 0]);
  const shinL = noodle([0.24, 0.032], mat, legL, [0, -0.26, 0]),
    shinR = noodle([0.24, 0.032], mat, legR, [0, -0.26, 0]);
  shoe(mat, shinL, -0.24, 0.9);
  shoe(mat, shinR, -0.24, 0.9);
  const J = {
    hips,
    torso,
    headG,
    armL,
    armR,
    foreL: armL,
    foreR: armR,
    legL,
    legR,
    shinL,
    shinR,
    gun: new THREE.Group(),
    spark,
  };
  root.scale.setScalar(T.scale);
  const tip =
    spark ||
    (() => {
      const o = new THREE.Object3D();
      o.position.set(0, 0.5, 0.5);
      torso.add(o);
      return o;
    })();
  return {
    root,
    parts: { torso: torsoPoint, head: headPoint },
    J,
    tip,
    face: fc,
    hit: [['torso', 0.5]] satisfies CharacterHit[],
  };
}
