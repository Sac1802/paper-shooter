import * as THREE from 'three';
import { BOSSES, planWave, bossFor, enemyName } from '../domain/waves.js';
import type { EnemyKind } from '../domain/enemies.js';
import { choose, clamp } from '../engine/math.js';
import type { WavePorts, WaveLevel } from './wave-contracts.js';

/** Solo wave progression and spawn policy, independent of kill observers and transport. */
export class WaveController {
  constructor(private readonly ports: WavePorts) {}
  tips() {
    const { hud } = this.ports;
    return [
      `hold <b>${hud.key('grapple')}</b> to reel in · tap it again to let go mid-swing`,
      `block with <b>${hud.key('block')}</b> and some of their bullets go back at them`,
      'kills in the air are worth more · stay off the floor',
      `<b>${hud.key('grenade')}</b> lobs a grenade · pickups give you more`,
      `press <b>${hud.key('jump')}</b> again in the air for a double jump`,
    ];
  }
  startWave(n: number) {
    const {
      state: game,
      hud,
      enemies,
      player,
      audio,
      spawnPickup,
      checkpoint,
      saveCheckpoint,
    } = this.ports;
    game.wave = n;
    game.queue = [];
    game.spawnT = 2;
    game.intermission = 0;
    game.boss = null;
    hud.setBoss(null, null);
    const plan = planWave(n);
    const { boss } = plan;
    game.queue = plan.queue;
    game.maxAlive = plan.maxAlive;
    enemies.mods.speed = plan.speed;
    enemies.mods.damage = plan.damage;
    const mod = { name: plan.modifier };
    hud.setModifier(mod.name);
    if (boss) {
      hud.message('WAVE ' + n, enemyName(bossFor(n)) + ' IS COMING', 3);
      audio.bossRoar(player.center);
    } else
      hud.message(
        'WAVE ' + n,
        n === 1
          ? 'they are crawling off the page'
          : mod.name ||
              choose([
                'ink harder',
                'keep scribbling',
                'stay off the ground',
                'swing for it',
                'return their bullets',
              ]),
        2.6,
      );
    audio.wave();
    if (n <= this.tips().length) hud.tip(this.tips()[n - 1], 7);
    player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
    for (let i = 0; i < 7; i++)
      spawnPickup(i < 5 ? 'ammo' : 'health', choose(this.ports.level().pickups));
    if (n >= 5 && n % 5 === 0 && n > checkpoint()) {
      saveCheckpoint(n);
      hud.kill('CHECKPOINT · WAVE ' + n, 0);
    }
  }
  pickSpawn(type: EnemyKind): THREE.Vector3 {
    const { player } = this.ports;
    const level = this.ports.level();
    const spots = type === 'sniper' ? level.snipers : level.spawns;
    const pp = player.body.pos;
    if (type === 'flyer') return this.flyerSpawn(level, pp);
    if (BOSSES.some((boss) => boss === type)) return this.bossSpawn(spots, pp, level.playerStart);
    return this.groundSpawn(spots);
  }
  private flyerSpawn(level: WaveLevel, pp: THREE.Vector3) {
    const angle = Math.random() * Math.PI * 2,
      radius = 22 + Math.random() * 10;
    return new THREE.Vector3(
      clamp(pp.x + Math.cos(angle) * radius, level.bounds.minX + 4, level.bounds.maxX - 4),
      pp.y + 12 + Math.random() * 6,
      clamp(pp.z + Math.sin(angle) * radius, level.bounds.minZ + 4, level.bounds.maxZ - 4),
    );
  }
  private bossSpawn(spots: readonly THREE.Vector3[], pp: THREE.Vector3, fallback: THREE.Vector3) {
    const { world } = this.ports;
    const fits = (point: THREE.Vector3) =>
      !world.overlapsAABB(
        { x: point.x - 1.1, y: point.y + 0.1, z: point.z - 1.1 },
        { x: point.x + 1.1, y: point.y + 5.2, z: point.z + 1.1 },
      );
    const open = spots.filter(fits);
    const far = open.filter((point) => point.distanceTo(pp) > 20);
    if (far.length) return choose(far).clone();
    if (open.length) return choose(open).clone();
    for (let attempt = 0; attempt < 200; attempt++) {
      const angle = Math.random() * Math.PI * 2,
        radius = 22 + Math.random() * 18;
      const candidate = new THREE.Vector3(
        clamp(pp.x + Math.cos(angle) * radius, -44, 44),
        0,
        clamp(pp.z + Math.sin(angle) * radius, -44, 44),
      );
      candidate.y = world.groundBelow(candidate.x, 30, candidate.z, 40);
      if (candidate.y > -3 && fits(candidate)) return candidate;
    }
    return fallback.clone();
  }
  private groundSpawn(spots: readonly THREE.Vector3[]) {
    const { player, world } = this.ports;
    const pp = player.body.pos;
    let cands = spots.filter((s) => {
      const d = s.distanceTo(pp);
      return d > 14 && d < 48;
    });
    if (cands.length < 2) cands = spots.filter((s) => s.distanceTo(pp) > 14);
    const hidden = cands.filter(
      (s) => !world.hasLineOfSight(player.eye, new THREE.Vector3(s.x, s.y + 1.2, s.z)),
    );
    return choose(hidden.length ? hidden : cands.length ? cands : spots).clone();
  }
  updateWaves(dt: number) {
    const { state: game, enemies, player, hud, audio, score } = this.ports;
    if (game.intermission > 0) {
      game.intermission -= dt;
      hud.setTimer('next wave in ' + Math.ceil(game.intermission));
      if (game.intermission <= 0) {
        hud.setTimer('');
        this.startWave(game.wave + 1);
      }
      return;
    }
    if (game.queue.length && enemies.alive < game.maxAlive) {
      game.spawnT -= dt;
      if (game.spawnT <= 0) {
        game.spawnT = Math.max(0.7, 2.9 - game.wave * 0.13);
        const t = game.queue[0];
        game.queue.shift();
        const e = enemies.spawn(t, this.pickSpawn(t));
        if (e.T.boss) {
          const mul = 1 + 0.35 * Math.floor((game.wave - 5) / 15);
          e.hp = e.maxHp = Math.round(e.T.hp * mul);
        }
      }
    }
    if (!game.queue.length && enemies.alive === 0) {
      game.intermission = 8;
      hud.message('WAVE ' + game.wave + ' CLEARED', 'catch your breath · +' + 200 * game.wave, 2.5);
      score(200 * game.wave, null);
      audio.waveClear();
      player.hp = Math.min(player.maxHp, player.hp + 40);
    }
    hud.setWave(game.wave, enemies.alive + game.queue.length);
  }
}
