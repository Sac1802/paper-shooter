import * as THREE from 'three';
import { makeInkMaterial } from '../presentation/ink/materials.js';
import { INK } from '../shared/ink.js';
import type {
  MapWorld,
  Level,
  BoxOptions,
  StairOptions,
  CylinderOptions,
  SphereOptions,
  PlaneOptions,
  WallGap,
} from './map-contracts.js';
export type { Level } from './map-contracts.js';

import { wallPieces } from './wall-gaps.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createBuilder(scene: THREE.Scene, world: MapWorld) {
  const geos: Record<string, THREE.BufferGeometry[]> = {};
  const L: Level = {
    rings: [],
    spawns: [],
    snipers: [],
    pickups: [],
    animated: [],
    meshes: [],
    playerStart: new THREE.Vector3(0, 0, 42),
    bounds: { minX: -55, maxX: 55, minZ: -55, maxZ: 55 },
    arenaSpawns: [],
    grappleMovers: [],
    breakables: [],
    key: 'district',
  };
  const addGeo = (g: THREE.BufferGeometry, ink: number) => (geos[ink] || (geos[ink] = [])).push(g);
  const collider = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    o: BoxOptions = {},
  ) =>
    world.addBox(
      { x: x - w / 2, y, z: z - d / 2 },
      { x: x + w / 2, y: y + h, z: z + d / 2 },
      { noNav: !!o.noNav, noShoot: !!o.noShoot, noGrapple: !!o.noGrapple, tag: o.tag },
    );
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    o: BoxOptions = {},
  ) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    addGeo(g, o.ink ?? INK.BLUE);
    if (!o.noCollide) collider(x, y, z, w, h, d, o);
  }
  const slab = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    y: number,
    t: number,
    o: BoxOptions = {},
  ) => box((x1 + x2) / 2, y - t, (z1 + z2) / 2, x2 - x1, t, z2 - z1, o); // top surface at y
  function wallX(
    x1: number,
    x2: number,
    z: number,
    y: number,
    h: number,
    t: number,
    gaps: readonly WallGap[] = [],
    o: BoxOptions = {},
  ) {
    for (const [a, b, yb, yt] of wallPieces(x1, x2, h, gaps))
      box((a + b) / 2, y + yb, z, b - a, yt - yb, t, o);
  }
  function wallZ(
    z1: number,
    z2: number,
    x: number,
    y: number,
    h: number,
    t: number,
    gaps: readonly WallGap[] = [],
    o: BoxOptions = {},
  ) {
    for (const [a, b, yb, yt] of wallPieces(z1, z2, h, gaps))
      box(x, y + yb, (a + b) / 2, t, yt - yb, b - a, o);
  }
  function stairs(
    x: number,
    y: number,
    z: number,
    dir: '+x' | '-x' | '+z' | '-z',
    steps: number,
    width: number,
    o: StairOptions = {},
  ) {
    const rise = o.rise ?? 4 / 14,
      run = o.run ?? 0.45;
    const dx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0,
      dz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
    for (let i = 0; i < steps; i++) {
      const c = (i + 0.5) * run,
        h = (i + 1) * rise;
      const cx = x + dx * c,
        cz = z + dz * c;
      box(cx, y, cz, dx ? run + 0.004 : width, h, dz ? run + 0.004 : width, o);
    }
    return { x: x + dx * steps * run, z: z + dz * steps * run, y: y + steps * rise };
  }
  // railing along an axis-aligned segment: visual posts + bar, one collider
  function rail(x1: number, z1: number, x2: number, z2: number, y: number, o: BoxOptions = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ax = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2,
      cz = (z1 + z2) / 2;
    box(cx, y + 0.9, cz, ax ? len : 0.12, 0.12, ax ? 0.12 : len, { noCollide: true, ink: o.ink });
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      box(x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t, 0.1, 0.9, 0.1, {
        noCollide: true,
        ink: o.ink,
      });
    }
    collider(cx, y, cz, ax ? len : 0.12, 1.0, ax ? 0.12 : len, { noNav: true, noShoot: true });
  }
  function cyl(x: number, y: number, z: number, r: number, h: number, o: CylinderOptions = {}) {
    const g = new THREE.CylinderGeometry(r, r, h, o.seg ?? 12);
    g.translate(x, y + h / 2, z);
    addGeo(g, o.ink ?? INK.BLUE);
    if (!o.noCollide) collider(x, y, z, r * 1.6, h, r * 1.6, o);
  }
  function sphere(x: number, y: number, z: number, r: number, o: SphereOptions = {}) {
    const g = new THREE.SphereGeometry(r, o.seg ?? 10, o.seg ?? 8);
    g.translate(x, y, z);
    addGeo(g, o.ink ?? INK.BLUE);
  }
  function ring(x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'z') {
    const g = new THREE.TorusGeometry(0.6, 0.1, 8, 20);
    if (axis === 'x') g.rotateY(Math.PI / 2);
    else if (axis === 'y') g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    addGeo(g, INK.ORANGE);
    L.rings.push(new THREE.Vector3(x, y, z));
  }
  const spawn = (x: number, y: number, z: number) => L.spawns.push(new THREE.Vector3(x, y, z));
  const sniper = (x: number, y: number, z: number) => L.snipers.push(new THREE.Vector3(x, y, z));
  const pickup = (x: number, y: number, z: number) => L.pickups.push(new THREE.Vector3(x, y, z));
  // ---------------- shared finish ----------------
  function finish() {
    for (const ink in geos) {
      const merged = mergeGeometries(geos[ink], false);
      if (!merged) throw new Error('Map geometry has incompatible attributes');
      const mesh = new THREE.Mesh(merged, makeInkMaterial({ ink: Number(ink) }));
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      L.meshes.push(mesh);
    }
    world.finalize();
    return L;
  }
  // a paper plane that loops overhead, purely decorative
  function planes(n: number, baseR: number, baseH: number, o: PlaneOptions = {}) {
    const sc = o.scale || 1;
    for (let i = 0; i < n; i++) {
      const g = new THREE.ConeGeometry(1.2 * sc, 4 * sc, 3);
      g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, makeInkMaterial({ ink: o.ink ?? INK.BLUE }));
      scene.add(m);
      L.meshes.push(m);
      L.grappleMovers.push({ mesh: m, radius: 2.2 * sc });
      const r = baseR + i * (o.rStep ?? 12),
        h = baseH + i * (o.hStep ?? 6),
        ph = i * 2.1,
        sp = (o.speed ?? 0.11) + i * 0.01;
      L.animated.push({
        mesh: m,
        update: (t: number) => {
          const a = t * sp + ph;
          m.position.set(Math.cos(a) * r, h + Math.sin(a * 2.3) * 3, Math.sin(a) * r * 0.7);
          m.lookAt(
            Math.cos(a + 0.05) * r,
            h + Math.sin((a + 0.05) * 2.3) * 3,
            Math.sin(a + 0.05) * r * 0.7,
          );
          m.rotateZ(Math.sin(a * 3) * 0.6);
        },
      });
    }
  }
  return {
    L,
    addGeo,
    collider,
    box,
    slab,
    wallX,
    wallZ,
    stairs,
    rail,
    cyl,
    sphere,
    ring,
    spawn,
    sniper,
    pickup,
    finish,
    planes,
    scene,
    world,
  };
}

export type MapKit = ReturnType<typeof createBuilder>;
export type MapBuilder = (kit: MapKit, arena?: boolean) => Level;
