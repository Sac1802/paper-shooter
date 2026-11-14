import { CylinderGeometry, Mesh, Vector3, type Scene } from 'three';
import { makeInkMaterial, type InkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
import { alignYAxis } from '../../engine/math.js';
import type { SceneResourcePort } from '../../engine/ports.js';
/** Lazily owns the sniper telegraph; match retirement releases it independently of the actor root. */
export class EnemyLaser {
  private mesh: Mesh<CylinderGeometry, InkMaterial> | null = null;
  private readonly direction = new Vector3();
  private readonly end = new Vector3();
  constructor(
    private readonly scene: Scene,
    private readonly resources: SceneResourcePort,
  ) {}
  show(from: Vector3, to: Vector3, charge: number) {
    if (!this.mesh) {
      this.mesh = new Mesh(
        new CylinderGeometry(1, 1, 1, 5),
        makeInkMaterial({ ink: INK.RED, fill: true }),
      );
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
      this.resources.track(this.mesh);
    }
    this.mesh.visible = true;
    const distance = this.direction.subVectors(to, from).length();
    // Keep the telegraph away from the viewer's face, even when the shot targets their eye.
    if (distance < 2) {
      this.mesh.visible = false;
      return;
    }
    this.end.copy(from).addScaledVector(this.direction, 1 - 1.6 / distance);
    alignYAxis(this.mesh, from, this.end, 0.006 + 0.012 * charge * charge);
  }
  setVisible(visible: boolean) {
    if (this.mesh) this.mesh.visible = visible;
  }
  hide() {
    this.setVisible(false);
  }
  dispose() {
    if (!this.mesh) return;
    this.resources.release(this.mesh);
    this.mesh = null;
  }
}
