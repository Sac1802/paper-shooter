import * as THREE from 'three';
import { makeInkMaterial } from './ink/materials.js';
import { INK } from '../shared/ink.js';
import type { PickupKind } from '../domain/pickups.js';
import type { MapKey } from '../domain/maps.js';
import type { ResourceLeasePort } from '../engine/ports.js';

export interface PickupFeedbackPorts {
  audio: { pickup(): void };
  hud: { kill(message: string, points: number): void };
  effects: {
    strokeBurst(
      point: THREE.Vector3,
      ink: number,
      count: number,
      speed: number,
      options: { life: number },
    ): void;
  };
}
export function presentPickup(
  ports: PickupFeedbackPorts,
  kind: PickupKind,
  map: MapKey,
  point: THREE.Vector3,
) {
  ports.hud.kill(
    kind === 'ammo' ? '+AMMO · +GRENADE' : map === 'mexico' ? 'TACO · +35 HP' : '+35 HP',
    0,
  );
  ports.audio.pickup();
  ports.effects.strokeBurst(point, kind === 'ammo' ? INK.BLUE : INK.GREEN, 12, 4, { life: 0.3 });
}

/** Reusable map-specific pickup geometry with one retained material palette. */
export class PickupModels {
  private readonly materials = {
    ammo: makeInkMaterial({ ink: INK.BLUE }),
    health: makeInkMaterial({ ink: INK.GREEN }),
    cap: makeInkMaterial({ ink: INK.BLACK }),
    shell: makeInkMaterial({ ink: INK.ORANGE }),
  };
  private readonly releaseMaterials: () => void;
  constructor(resources: ResourceLeasePort) {
    this.releaseMaterials = resources.retain(Object.values(this.materials));
  }
  create(kind: PickupKind, map: MapKey) {
    const pmat = this.materials;
    const g = new THREE.Group();
    if (kind === 'ammo') {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.5, 10), pmat.ammo));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8), pmat.cap);
      c.position.y = 0.33;
      g.add(c);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), pmat.cap);
      l.position.set(0, 0, 0.24);
      g.add(l);
    } else if (map === 'mexico') {
      const sh = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12, 1, false, 0, Math.PI);
      sh.rotateZ(Math.PI / 2);
      sh.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(sh, pmat.shell));
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.2), pmat.health);
      f.position.y = 0.02;
      g.add(f);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.14), pmat.cap);
      m.position.y = 0.1;
      g.add(m);
    } else {
      g.add(
        new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), pmat.health),
        new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), pmat.health),
      );
    }
    return g;
  }
  dispose() {
    this.releaseMaterials();
  }
}
