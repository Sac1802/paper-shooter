import { Vector3 } from 'three';
import type { Camera } from 'three';

interface MarkerPorts {
  camera: Camera;
  viewport: { readonly innerWidth: number; readonly innerHeight: number };
  hud: { setFocusMark(x: number | null, y?: number): void };
}
/** Owns projection and viewport conversion, reusing scratch storage across frames. */
export class FocusMarker {
  private readonly projected = new Vector3();
  constructor(private readonly ports: MarkerPorts) {}
  show(point: Vector3 | null) {
    const { camera, viewport, hud } = this.ports;
    if (!point) {
      hud.setFocusMark(null);
      return;
    }
    this.projected.copy(point).project(camera);
    if (this.projected.z < 1)
      hud.setFocusMark(
        (this.projected.x * 0.5 + 0.5) * viewport.innerWidth,
        (-this.projected.y * 0.5 + 0.5) * viewport.innerHeight,
      );
    else hud.setFocusMark(null);
  }
}
