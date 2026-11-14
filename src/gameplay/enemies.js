// Enemy population and frame/lifecycle coordination; actor composition has explicit checked capabilities.
import * as THREE from 'three';
import { INK } from '../shared/ink.js';
import { clamp } from '../engine/math.js';
import { EnemyReplication } from './enemies/replication.js';
import { EnemySimulation } from './enemies/simulation.js';
import { EnemyAreaDamage } from './enemies/area-damage.js';
import { EnemyLifecycle } from './enemies/lifecycle.js';
import { EnemyDeathFeedback } from '../presentation/characters/death-feedback.js';
import { EnemyActor } from './enemies/actor.js';
import { EnemyPopulation } from './enemies/population.js';
import { EnemyQueries } from './enemies/queries.js';
import { BossFeedback } from '../presentation/characters/boss-feedback.js';
import { ProjectileView } from '../presentation/projectiles.js';
import { Projectiles } from './projectiles.js';
const _v = new THREE.Vector3(),
  _d = new THREE.Vector3();
export { BOSSES } from '../domain/waves.js';
export { TYPES, STATE_CODES, STATE_NAMES } from '../domain/enemies.js';
export class EnemyManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.population = new EnemyPopulation();
    this.releaseEntity = (e) => {
      e.telegraph.dispose();
      if (!e.rootDetached) ctx.resources.release(e.root);
    };
    this.queries = new EnemyQueries(
      () => this.enemies,
      () => this.targets(),
      ctx.world,
    );
    this.bossFeedback = new BossFeedback(ctx.effects, ctx.audio);
    const deathFeedback = new EnemyDeathFeedback(ctx.scene, ctx.effects, ctx.audio);
    this.area = new EnemyAreaDamage(
      () => this.enemies,
      () => this.targets(),
      {
        damage: (enemy, amount, impact) => this.damage(enemy, amount, impact),
        damageModifier: () => this.mods.damage,
        feedback: deathFeedback,
      },
    );
    this.lifecycle = new EnemyLifecycle(this.population, this.area, deathFeedback, {
      resources: ctx.resources,
      score: (points, label) => ctx.game.addScore(points, label),
      killed: (enemy, impact, sever) => this.onKill?.(enemy, impact, sever),
      bossChanged: (enemy) => this.onBoss?.(enemy),
    });
    this.replication = new EnemyReplication(
      () => this.enemies,
      () => this.byId,
      (enemy) => this.onBoss?.(enemy),
    );
    this.simulation = new EnemySimulation(() => this.enemies, ctx.world, {
      target: (enemy, dt) => this._pickTarget(enemy, dt) || ctx.player,
      kill: (enemy, impact) => this.kill(enemy, impact),
    });
    this.actorServices = {
      environment: {
        scene: ctx.scene,
        resources: ctx.resources,
        world: ctx.world,
        navigation: () => ctx.nav,
      },
      feedback: {
        effects: ctx.effects,
        audio: ctx.audio,
        hud: ctx.hud,
        input: ctx.input,
        boss: this.bossFeedback,
      },
      policy: {
        present: (ref) => this.byId.get(ref.id) === ref,
        mirror: () => this.mirror,
        damageModifier: () => this.mods.damage,
        speedModifier: () => this.mods.speed,
        localSpeed: () => ctx.player.speed,
        targets: () => this.targets(),
        kill: (ref, impact) => {
          const actor = this.resolveActor(ref);
          if (actor) this.kill(actor, impact);
        },
        clientHit: (ref, amount, impact) => {
          const actor = this.resolveActor(ref);
          if (actor) this.onClientHit?.(actor, amount, impact);
        },
        bossChanged: (ref) => {
          const actor = this.resolveActor(ref);
          if (actor) this.onBoss?.(actor);
        },
        shieldBroken: () => this._shieldBroken(),
        hitstop: (duration, scale) => ctx.game.hitstop(duration, scale),
        explode: (ref, scale) => {
          const actor = this.resolveActor(ref);
          if (actor) this._explodeBomber(actor, scale);
        },
        emit: (owner, position, direction, shot) =>
          this.projectiles.fire(position, direction, { ...shot, owner }),
        blast: (ref, point, radius, damage) => {
          const actor = this.resolveActor(ref);
          if (actor) this.blastEnemies(point, radius, damage, actor);
        },
        count: (kind) => this.count(kind),
        spawnReady: (kind, position) => this.spawnReady(kind, position),
      },
    };
    this.projectiles = new Projectiles(
      {
        world: ctx.world,
        player: () => ctx.player,
        targets: () => this.targets(),
        allocateId: () => this.population.allocateId(),
        authoritative: () => !this.mirror,
        queries: this.queries,
        damage: (enemy, amount, hit) => this.damage(enemy, amount, hit),
        blast: (point, radius, damage, except) => this.blastEnemies(point, radius, damage, except),
        effects: ctx.effects,
        audio: ctx.audio,
      },
      new ProjectileView(ctx.scene, 240),
    );
    this.onKill = null;
    this.onBoss = null;
    this._slot = 0;
    this.mods = { speed: 1, damage: 1 };
    // mirror mode: this peer is a client; the host owns AI, physics and health, we only render
    this.mirror = false;
    this.onClientHit = null;
    this.onSpawn = null;
  }
  resolveActor(ref) {
    const actor = this.byId.get(ref.id);
    return actor === ref ? actor : null;
  }
  get enemies() {
    return this.population.entries;
  }
  get alive() {
    return this.population.alive;
  }
  get byId() {
    return this.population.byId;
  }
  // Everyone an enemy may go after. Solo play is just the local player.
  targets() {
    return this.ctx.targets ? this.ctx.targets() : [this.ctx.player];
  }
  _pickTarget(e, dt) {
    return this.queries.pickTarget(e, dt);
  }
  nearestTarget(pos) {
    return this.queries.nearestTarget(pos);
  }
  clear() {
    this.population.clear(this.releaseEntity);
    this.projectiles.clear();
    this.replication.clear();
  }
  spawn(type, pos, id = null) {
    const e = new EnemyActor(type, pos, this._slot++, this.actorServices),
      T = e.T;
    e.id = id ?? this.population.allocateId();
    e.body.alwaysStep = true;
    if (T.flying) e.body.noSnap = true;
    e.root.position.copy(pos);
    e.root.scale.setScalar(0.001);
    this.ctx.scene.add(e.root);
    this.ctx.resources.track(e.root);
    this.population.add(e);
    if (this.onSpawn && !this.mirror) this.onSpawn(e);
    this.ctx.effects.strokeBurst(
      pos.clone().add(_v.set(0, 1, 0)),
      T.ink ?? INK.RED,
      T.boss ? 60 : 26,
      T.boss ? 10 : 6,
      { life: 0.5, size: 0.03 },
    );
    this.ctx.audio.spawn(pos);
    if (T.boss) {
      this.ctx.audio.bossRoar(pos);
      if (this.onBoss) this.onBoss(e);
    }
    return e;
  }
  count(kind) {
    return this.population.count(kind);
  }
  spawnReady(kind, position) {
    const enemy = this.spawn(kind, position);
    enemy.state = 'hunt';
    enemy.root.scale.setScalar(enemy.T.scale);
  }
  nearestVisible(from, forward, cosHalf, maxDist) {
    return this.queries.nearestVisible(from, forward, cosHalf, maxDist);
  }
  raycast(o, d, maxDist, ignore = null) {
    return this.queries.raycast(o, d, maxDist, ignore);
  }
  inArc(pos, dir, range, cosHalf) {
    return this.queries.inArc(pos, dir, range, cosHalf);
  }
  blastEnemies(point, radius, damage, except) {
    this.area.blast(point, radius, damage, except);
  }
  yank(e, target) {
    if (!e.alive) return;
    if (e.T.boss) {
      e.hitFeedback.nudge();
      return;
    }
    e.state = 'stunned';
    e.t = 0;
    e.stunDur = 1.3;
    e.navigation.invalidate();
    e.flyer?.stun();
    _d.subVectors(target, e.body.pos);
    const dist = _d.length();
    _d.divideScalar(Math.max(dist, 0.01));
    e.body.vel.copy(_d).multiplyScalar(clamp(dist * 1.6, 10, 26));
    e.body.vel.y = clamp(dist * 0.5, 4, 9);
    e.body.onGround = false;
    this.ctx.effects.blood(e.center, _d, 0.4);
  }
  damage(e, amount, info) {
    e.combat.damage(amount, info);
  }
  _breakShield(e) {
    if (e.disassembly?.breakShield()) this._shieldBroken();
  }
  _shieldBroken() {
    this.lifecycle.shieldBroken();
  }
  kill(enemy, impact, notify = true) {
    this.lifecycle.kill(enemy, impact, notify);
  }
  _explodeBomber(enemy, scale = 1) {
    this.lifecycle.explode(enemy, scale);
  }
  eye(e, out) {
    return e.eye(out);
  }
  update(dt) {
    if (this.mirror) {
      this._updateMirror(dt);
      return;
    }
    this.simulation.update(dt);
    this.projectiles.update(dt);
    this.population.retire(9, this.releaseEntity);
  }
  // --- network mirror ---
  // Compact per-enemy state the host sends every few frames; clients ease toward it.
  snapshot() {
    return this.replication.snapshot();
  }
  applySnapshot(rows, now) {
    this.replication.apply(rows, now);
  }
  _updateMirror(dt) {
    const now = performance.now() / 1000,
      P = this.ctx.player;
    for (const e of this.enemies) {
      e.t += dt;
      if (!e.alive) {
        this._updateDead(e, dt);
        continue;
      }
      e.hitFeedback.update(dt);
      if (e.state === 'spawn') {
        const f = clamp(e.t / 0.6, 0, 1);
        e.root.scale.setScalar(
          Math.max(0.001, f * e.T.scale * (1 + Math.sin(e.t * 60) * 0.12 * (1 - f))),
        );
        if (e.t >= 0.6) {
          e.state = 'hunt';
          e.root.scale.setScalar(e.T.scale);
        }
      }
      this.replication.interpolate(e, dt, now);
      e.root.position.copy(e.body.pos);
      e.root.rotation.y = e.yaw;
      this._animate(e, dt, P.center);
      if (e.T.weapon === 'sniper')
        e.telegraph.setVisible((e.rangedBehavior?.aimAmt ?? e.aimAmt) > 0.9);
      this._syncHit(e);
    }
    this.projectiles.update(dt);
    this.population.retire(9, this.releaseEntity);
  }
  // the host tells us someone died; run the gore without touching scores
  killMirror(id, impact) {
    this.lifecycle.killMirror(id, impact);
  }
  _syncHit(e) {
    e.syncHit();
  }
  _updateDead(e, dt) {
    e.updateDead(dt);
  }

  _animate(e, dt, point) {
    e.animate(dt, point);
  }
}
