// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';
import baseline from '../fixtures/pickups-baseline.json';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
});
it.each(['district', 'mexico'])('preserves %s pickup geometry, materials and animation', (map) => {
  fixture = applicationFixture(map);
  const { app, resources } = fixture;
  const pickups = ['ammo', 'health'].map((kind) =>
    app.pickups.spawnPickup(kind, new Vector3(30, 1, 30)),
  );
  const hash = createHash('sha256');
  for (const pickup of pickups) {
    pickup.mesh.updateMatrixWorld(true);
    pickup.mesh.traverse((node) => {
      if (!node.isMesh) return;
      for (const [name, attribute] of Object.entries(node.geometry.attributes)) {
        hash.update(name);
        hash.update(
          Buffer.from(
            attribute.array.buffer,
            attribute.array.byteOffset,
            attribute.array.byteLength,
          ),
        );
      }
      if (node.geometry.index) hash.update(Buffer.from(node.geometry.index.array.buffer));
      hash.update(
        JSON.stringify({
          matrix: node.matrixWorld.elements.map((value) => +value.toFixed(10)),
          uniforms: node.material.uniforms,
        }),
      );
    });
  }
  const frames = [];
  for (const dt of [0, 0.1, 0.5, 1]) {
    app.pickups.updatePickups(dt);
    frames.push(
      pickups.map((pickup) => ({
        id: pickup.id,
        t: pickup.t,
        life: pickup.life,
        y: pickup.mesh.position.y,
        rotation: pickup.mesh.rotation.y,
      })),
    );
  }
  const result = {
    geometry: hash.digest('hex'),
    frames: JSON.parse(
      JSON.stringify(frames, (_key, value) =>
        typeof value === 'number' ? +value.toFixed(10) : value,
      ),
    ),
    resources: resources.resourceCount,
    randomCalls: vi.mocked(Math.random).mock.calls.length,
  };
  if (process.env.RECORD_PICKUPS_BASELINE === '1') {
    const file = 'tests/fixtures/pickups-baseline.json';
    const recorded = JSON.parse(readFileSync(file, 'utf8'));
    recorded.source = 'd71857d';
    recorded[map] = result;
    writeFileSync(file, JSON.stringify(recorded, null, 2) + '\n');
  } else expect(result).toEqual(baseline[map]);
});

it('caps collection rewards and reports host/follower collection with the existing messages', () => {
  fixture = applicationFixture('mexico');
  const { app, player, net, hud, resources, state } = fixture;
  player.hp = player.maxHp - 10;
  player.grenades = player.maxGrenades;
  const hp = player.maxHp;
  const resourcesBefore = resources.resourceCount;
  const pos = player.center.clone().add(new Vector3(0, -0.6, 0));
  net.id = 'local';
  net.connected = true;
  net.peer = { destroy() {} };
  net.isHost = true;
  const send = vi.spyOn(net, 'send').mockImplementation(() => {});
  const kill = vi.spyOn(hud, 'kill');
  const health = app.pickups.spawnPickup('health', pos, 99);
  expect(send).toHaveBeenLastCalledWith('pickup', { id: 99, kind: 'health', pos: pos.toArray() });
  app.pickups.updatePickups(0);
  expect(player.hp).toBe(hp);
  expect(state.pickups).not.toContain(health);
  expect(kill).toHaveBeenLastCalledWith('TACO · +35 HP', 0);
  expect(send).toHaveBeenLastCalledWith('taken', { id: 99 });
  net.isHost = false;
  const ammo = app.pickups.spawnPickup('ammo', pos);
  app.pickups.updatePickups(0);
  expect(player.grenades).toBe(player.maxGrenades);
  expect(kill).toHaveBeenLastCalledWith('+AMMO · +GRENADE', 0);
  expect(send).toHaveBeenLastCalledWith('take', { id: ammo.id });
  expect(resources.resourceCount).toBe(resourcesBefore);
});

it('lets the host expire pickups while followers retain them until a removal report', () => {
  fixture = applicationFixture();
  const { app, net, state } = fixture;
  const pickup = app.pickups.spawnPickup('health', new Vector3(100, 0, 100));
  net.connected = true;
  net.peer = { destroy() {} };
  net.isHost = false;
  app.pickups.updatePickups(50);
  expect(pickup.life).toBe(45);
  expect(state.pickups).toContain(pickup);
  net.isHost = true;
  const send = vi.spyOn(net, 'send').mockImplementation(() => {});
  app.pickups.updatePickups(45);
  expect(state.pickups).not.toContain(pickup);
  expect(send).toHaveBeenLastCalledWith('taken', { id: pickup.id });
});

it('caps host arena replenishment and resolves new level spawn points after replacement', () => {
  fixture = applicationFixture();
  const { app, state, net } = fixture;
  state.pickupClock = 0;
  app.pickups.updateArenaPickups(1);
  expect(state.pickups).toHaveLength(0);
  net.isHost = true;
  state.level.pickups = [new Vector3(100, 0, 100)];
  app.pickups.updateArenaPickups(1);
  expect(state.pickups).toHaveLength(1);
  expect(state.pickupClock).toBe(7);
  for (let i = 0; i < 9; i++) app.pickups.spawnPickup('ammo', new Vector3(100, 0, 100));
  app.pickups.updateArenaPickups(8);
  expect(state.pickups).toHaveLength(10);
  expect(state.pickupClock).toBe(-1);
  for (const pickup of [...state.pickups]) app.pickups.removePickup(pickup);
  app.runtime.setLevel('mexico', true);
  state.level.pickups = [new Vector3(-100, 2, -100)];
  app.pickups.updateArenaPickups(0);
  expect(state.pickups[0].mesh.position).toEqual(new Vector3(-100, 2.6, -100));
});
