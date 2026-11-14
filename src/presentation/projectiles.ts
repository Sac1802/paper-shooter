import * as THREE from 'three';
import { makeInkMaterial } from './ink/materials.js';
import { INK } from '../shared/ink.js';
import { clamp } from '../engine/math.js';

export interface ProjectileVisual {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  thick: number;
  blast: number;
  ink: number;
}
/** Owns instance buffers and scratch transforms; simulation supplies a borrowed frame list. */
export class ProjectileView {
  readonly mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.ShaderMaterial> & {
    instanceColor: THREE.InstancedBufferAttribute;
  };
  private readonly direction = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  constructor(scene: THREE.Scene, capacity: number) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      makeInkMaterial({ ink: INK.RED, fill: true }),
      capacity,
    );
    const instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh = Object.assign(mesh, { instanceColor });
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
  }
  clear() {
    this.mesh.count = 0;
  }
  render(list: readonly ProjectileVisual[]) {
    const mesh = this.mesh;
    for (let i = 0; i < list.length; i++) {
      const p = list[i],
        speed = p.vel.length();
      this.direction.copy(p.vel).divideScalar(speed);
      this.rotation.setFromUnitVectors(this.up, this.direction);
      this.scale.set(p.thick, p.blast ? p.thick : clamp(speed * 0.02, 0.35, 0.9), p.thick);
      this.matrix.compose(p.pos, this.rotation, this.scale);
      mesh.setMatrixAt(i, this.matrix);
      const color = mesh.instanceColor.array;
      color[i * 3] = p.ink;
      color[i * 3 + 1] = 1;
      color[i * 3 + 2] = 0;
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
}
