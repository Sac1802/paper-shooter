// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { NavGrid } from '../../src/engine/navigation.js';
import { applicationFixture } from '../support/application.js';
import baseline from '../fixtures/enemies-baseline.json';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});
const number = (value) => +value.toFixed(10);
const vector = (value) => value.toArray().map(number);
function geometry(enemy) {
  const hash = createHash('sha256');
  enemy.root.traverse((node) => {
    if (!node.isMesh) return;
    for (const [name, attribute] of Object.entries(node.geometry.attributes)) {
      hash.update(name);
      hash.update(
        Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength),
      );
    }
    const index = node.geometry.index;
    if (index)
      hash.update(Buffer.from(index.array.buffer, index.array.byteOffset, index.array.byteLength));
  });
  hash.update(JSON.stringify(enemy.hit));
  return hash.digest('hex');
}
function frame(enemy) {
  const { enemies, player, effects, resources, game } = fixture;
  enemy.root.updateMatrixWorld(true);
  const nodes = [];
  enemy.root.traverse((node) =>
    nodes.push({
      matrix: node.matrixWorld.elements.map(number),
      visible: node.visible,
      ink: node.material?.uniforms?.uInk.value,
      fill: node.material?.uniforms?.uFill.value,
    }),
  );
  return {
    state: enemy.state,
    hp: number(enemy.hp),
    alive: enemy.alive,
    pos: vector(enemy.body.pos),
    vel: vector(enemy.body.vel),
    ground: enemy.body.onGround,
    yaw: number(enemy.yaw),
    boss: enemy.bossAtk,
    fly: enemy.flyState,
    fuse: number(enemy.fuseT),
    attack: number(enemy.attackT),
    burst: enemy.ranged?.burstLeft ?? 0,
    aim: number(enemy.ranged?.aimT ?? 0),
    los: enemy.los,
    nodes,
    projectiles: enemies.projectiles.list.map((projectile) => ({
      id: projectile.id,
      owner: projectile.owner?.id,
      pos: vector(projectile.pos),
      vel: vector(projectile.vel),
      damage: number(projectile.dmg),
      life: number(projectile.life),
      deflected: projectile.deflected,
      blast: projectile.blast,
    })),
    playerHp: number(player.hp),
    score: game.score,
    aliveCount: enemies.alive,
    entities: enemies.enemies.length,
    fragments: effects.debrisList.length,
    resources: resources.resourceCount,
    randomCalls: vi.mocked(Math.random).mock.calls.length,
  };
}

it.each(Object.keys(TYPES))(
  'preserves %s AI, animation, projectiles and retirement through composed play',
  (type) => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    const { app, player, enemies, world, state, ctx, game, input } = fixture;
    app.controls.begin();
    game.queue = [];
    game.intermission = 100000;
    world.clear();
    world.addBox({ x: -40, y: -1, z: -40 }, { x: 40, y: 0, z: 40 });
    world.finalize();
    const navigation = () => {
      state.nav = new NavGrid(world, { minX: -25, maxX: 25, minZ: -25, maxZ: 25 }, 2).build();
      ctx.nav = state.nav;
    };
    navigation();
    const movePlayer = (x, y, z) => {
      player.body.pos.set(x, y, z);
      player.body.vel.set(0, 0, 0);
    };
    movePlayer(0, 0, 0);
    player.maxHp = player.hp = 1000000;
    const enemy = enemies.spawn(type, new Vector3(0, 0, -8)),
      shape = geometry(enemy),
      frames = [frame(enemy)];
    let platform;
    for (let i = 1; i <= 320; i++) {
      if (i === 80) movePlayer(10, 0, 12);
      if (i === 100)
        enemies.damage(enemy, 10, {
          point: enemy.center.clone(),
          dir: new Vector3(0, 1, 0),
          part: 'torso',
          source: 'rifle',
          crit: false,
        });
      if ((i === 120 || i === 140) && enemy.alive && enemy.shieldHp > 0)
        enemies.damage(enemy, 5, {
          point: enemy.center.clone(),
          dir: new Vector3(0, 1, 0),
          part: 'shield',
          source: 'katana',
          crit: false,
        });
      if (i === 160) {
        player.switchTo(3);
        input.keys.aim = true;
      }
      if (i === 180) {
        input.keys.aim = false;
        player.switchTo(0);
      }
      if (i === 200) {
        platform = world.addBox({ x: -3, y: 0, z: -3 }, { x: 3, y: 3, z: 3 });
        world.finalize();
        navigation();
        movePlayer(0, 3, 0);
      }
      if (i === 260) {
        world.removeBox(platform);
        navigation();
        movePlayer(12, 0, 4);
      }
      fixture.frame(0.05);
      expect(enemy.body.pos.toArray().every(Number.isFinite)).toBe(true);
      if ([1, 12, 40, 80, 100, 150, 200, 260, 320].includes(i)) frames.push(frame(enemy));
    }
    if (enemy.alive)
      enemies.damage(enemy, 100000, {
        point: enemy.center.clone(),
        dir: new Vector3(0, 1, 0),
        part: 'torso',
        source: 'katana',
        crit: true,
      });
    frames.push(frame(enemy));
    fixture.frame(0.05, 220);
    frames.push(frame(enemy));
    const fingerprint = {
      geometry: shape,
      simulation: createHash('sha256').update(JSON.stringify(frames)).digest('hex'),
    };
    if (process.env.RECORD_ENEMY_BASELINE === '1') {
      const path = 'tests/fixtures/enemies-baseline.json',
        saved = JSON.parse(readFileSync(path, 'utf8'));
      saved[type] = fingerprint;
      writeFileSync(path, JSON.stringify(saved, null, 2) + '\n');
    } else {
      if (fingerprint.simulation !== baseline[type]?.simulation) {
        mkdirSync('reports', { recursive: true });
        writeFileSync(`reports/enemy-${type}-trace.json`, JSON.stringify({ fingerprint, frames }));
      }
      expect(fingerprint).toEqual(baseline[type]);
    }
    expect(enemy.alive).toBe(false);
  },
);
