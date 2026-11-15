import * as THREE from 'three';
import { makeInkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
import type { SceneResourcePort } from '../../engine/ports.js';
const _m = new THREE.Matrix4();
export class InstancePool {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly colors: THREE.InstancedBufferAttribute;
  next = 0;
  used = 0;
  constructor(
    scene: THREE.Scene,
    private readonly resources: SceneResourcePort,
    geo: THREE.BufferGeometry,
    readonly max: number,
    double = false,
  ) {
    const mat = makeInkMaterial({
      ink: INK.RED,
      fill: true,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    mesh.instanceColor = this.colors;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    resources.track(mesh);
    this.mesh = mesh;
  }
  write(
    i: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    scale: THREE.Vector3,
    ink: number,
    fill: boolean,
  ) {
    _m.compose(pos, quat, scale);
    this.mesh.setMatrixAt(i, _m);
    const c = this.colors.array;
    c[i * 3] = ink;
    c[i * 3 + 1] = fill ? 1 : 0;
    c[i * 3 + 2] = 0;
  }
  upload() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colors.needsUpdate = true;
  }
  allocate() {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.used = Math.min(this.used + 1, this.max);
    this.mesh.count = this.used;
    return i;
  }
  reset() {
    this.next = 0;
    this.used = 0;
    this.mesh.count = 0;
  }
  dispose() {
    this.resources.release(this.mesh);
  }
}
