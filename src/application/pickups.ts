import type { Vector3 } from 'three';
import type { PickupKind } from '../domain/pickups.js';
import { rand, choose } from '../engine/math.js';
import { PickupModels } from '../presentation/pickups.js';
import type { Pickup, PickupPorts } from './pickup-contracts.js';

/** Owns collection, expiry and host replenishment; model recipes never see gameplay state. */
export class PickupController {
  private pickupId = 1;
  private readonly models: PickupModels;
  constructor(private readonly ports: PickupPorts) {
    this.models = new PickupModels(ports.resources);
  }
  makePickup(kind: PickupKind) {
    return this.models.create(kind, this.ports.map());
  }
  spawnPickup(kind: PickupKind, point: Vector3, id: number | null = null): Pickup {
    const { scene, resources, state, transport } = this.ports;
    const mesh = this.makePickup(kind);
    mesh.position.copy(point);
    mesh.position.y += 0.6;
    scene.add(mesh);
    resources.track(mesh);
    const pickup = {
      id: id ?? this.pickupId++,
      kind,
      mesh,
      base: mesh.position.y,
      t: rand(0, 6),
      life: 45,
    };
    state.pickups.push(pickup);
    if (transport.isHost)
      transport.send('pickup', { id: pickup.id, kind, pos: [point.x, point.y, point.z] });
    return pickup;
  }
  removePickup(pickup: Pickup) {
    const { state, resources } = this.ports;
    resources.release(pickup.mesh);
    const index = state.pickups.indexOf(pickup);
    if (index >= 0) state.pickups.splice(index, 1);
  }
  collectPickup(pickup: Pickup) {
    const { player, collected } = this.ports;
    if (pickup.kind === 'ammo') {
      player.addAmmoAll(0.4);
      player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
    } else player.hp = Math.min(player.maxHp, player.hp + 35);
    collected(pickup.kind, pickup.mesh.position);
  }
  updatePickups(dt: number) {
    const { state, player, transport } = this.ports;
    for (let index = state.pickups.length - 1; index >= 0; index--) {
      const pickup = state.pickups[index];
      pickup.t += dt;
      pickup.mesh.position.y = pickup.base + Math.sin(pickup.t * 2.5) * 0.12;
      pickup.mesh.rotation.y += dt * 1.8;
      if (player.alive && pickup.mesh.position.distanceTo(player.center) < 1.5) {
        this.collectPickup(pickup);
        this.removePickup(pickup);
        if (transport.active)
          transport.send(transport.isHost ? 'taken' : 'take', { id: pickup.id });
        continue;
      }
      if (!transport.active || transport.isHost) {
        pickup.life -= dt;
        if (pickup.life <= 0) {
          this.removePickup(pickup);
          if (transport.isHost) transport.send('taken', { id: pickup.id });
        }
      }
    }
  }
  updateArenaPickups(dt: number) {
    const { state, transport, spawnPoints } = this.ports;
    if (!transport.isHost) return;
    state.pickupClock -= dt;
    if (state.pickupClock <= 0 && state.pickups.length < 10) {
      state.pickupClock = 7;
      this.spawnPickup('ammo', choose(spawnPoints()));
    }
  }
  dispose() {
    for (const pickup of [...this.ports.state.pickups]) this.removePickup(pickup);
    this.models.dispose();
  }
}
