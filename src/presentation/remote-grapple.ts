import * as THREE from 'three';
import { makeInkMaterial } from './ink/materials.js';
import { INK } from '../shared/ink.js';
import type { SceneResourcePort } from '../engine/ports.js';
/** Owns the remote rope/hook geometry, projection and retirement; it has no player/network access. */
export class RemoteGrapple {
  readonly rope: THREE.Mesh;
  readonly hook: THREE.Mesh;
  private readonly hand = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  constructor(
    scene: THREE.Scene,
    private readonly resources: SceneResourcePort,
  ) {
    this.rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1, 5),
      makeInkMaterial({ ink: INK.BLACK }),
    );
    this.rope.visible = false;
    scene.add(this.rope);
    resources.track(this.rope);
    this.hook = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 5),
      makeInkMaterial({ ink: INK.BLACK, fill: true }),
    );
    this.hook.visible = false;
    scene.add(this.hook);
    resources.track(this.hook);
  }
  hide() {
    this.rope.visible = false;
    this.hook.visible = false;
  }
  update(on: boolean, position: THREE.Vector3, right: THREE.Vector3, point: THREE.Vector3) {
    this.rope.visible = on;
    this.hook.visible = on;
    if (!on) return;
    this.hand.set(position.x + right.x * 0.35, position.y + 1.25, position.z + right.z * 0.35);
    this.direction.subVectors(point, this.hand);
    const length = this.direction.length();
    if (length < 0.05) {
      this.rope.visible = false;
      return;
    }
    this.rope.position.copy(this.hand).addScaledVector(this.direction, 0.5);
    this.rope.scale.set(1, length, 1);
    this.rope.quaternion.setFromUnitVectors(this.up, this.direction.divideScalar(length));
    this.hook.position.copy(point);
  }
  dispose() {
    this.resources.release(this.rope);
    this.resources.release(this.hook);
  }
}
