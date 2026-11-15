// Composition and public enemy-system API; frame and lifecycle policies have separate owners.
import * as THREE from 'three';
import { INK } from '../shared/ink.js';
import { clamp } from '../engine/math.js';
import { EnemyReplication } from './enemies/replication.js';
import { EnemyPlayback } from './enemies/playback.js';
import type { EnemySystemServices } from './enemies/system-contracts.js';
import type { EnemyActorRef, EnemyActorServices, EnemyTarget } from './enemies/actor-contracts.js';
import type { EnemyImpact } from '../domain/enemy-impact.js';
import type { EnemyKind } from '../domain/enemies.js';
import type { EnemySnapshot } from '../domain/enemy-snapshots.js';
import type { MirroredEnemyDeath } from './enemies/lifecycle.js';
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
export { BOSSES } from '../domain/waves.js';
export { TYPES, STATE_CODES, STATE_NAMES } from '../domain/enemies.js';
export class EnemyManager {
  private readonly population = new EnemyPopulation<EnemyActor>();
  private readonly releaseEntity: (enemy: EnemyActor) => void;
  private readonly queries: EnemyQueries<EnemyActor, EnemyTarget>;
  private readonly areaDamage: EnemyAreaDamage<EnemyActor>;
  private readonly lifecycle: EnemyLifecycle;
  private readonly replication: EnemyReplication<EnemyActor>;
  private readonly simulation: EnemySimulation<EnemyActor>;
  private readonly playback: EnemyPlayback<EnemyActor>;
  private readonly actorServices: EnemyActorServices;
  readonly projectiles: Projectiles<EnemyActor>;
  private readonly offset = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private slot = 0;
  readonly mods = { speed: 1, damage: 1 };
  // The host owns AI, physics and health; a mirror only presents replicas.
  mirror = false;
  onKill: ((enemy: EnemyActor, impact: EnemyImpact, severed: boolean) => void) | null = null;
  onBoss: ((enemy: EnemyActor) => void) | null = null;
  onClientHit: ((enemy: EnemyActor, amount: number, impact: EnemyImpact) => void) | null = null;
  onSpawn: ((enemy: EnemyActor) => void) | null = null;
  constructor(private readonly services: EnemySystemServices) {
    this.releaseEntity = (e) => {
      e.telegraph.dispose();
      if (!e.rootDetached) services.resources.release(e.root);
    };
    this.queries = new EnemyQueries(
      () => this.enemies,
      () => this.targets(),
      services.world,
    );
    const bossFeedback = new BossFeedback(services.effects, services.audio);
    const deathFeedback = new EnemyDeathFeedback(services.scene, services.effects, services.audio);
    this.areaDamage = new EnemyAreaDamage(
      () => this.enemies,
      () => this.targets(),
      {
        damage: (enemy, amount, impact) => this.damage(enemy, amount, impact),
        damageModifier: () => this.mods.damage,
        feedback: deathFeedback,
      },
    );
    this.lifecycle = new EnemyLifecycle(this.population, this.areaDamage, deathFeedback, {
      resources: services.resources,
      score: (points, label) => services.score(points, label),
      killed: (enemy, impact, sever) => this.onKill?.(enemy, impact, sever),
      bossChanged: (enemy) => this.onBoss?.(enemy),
    });
    this.replication = new EnemyReplication(
      () => this.enemies,
      () => this.byId,
      (enemy) => this.onBoss?.(enemy),
    );
    this.simulation = new EnemySimulation(() => this.enemies, services.world, {
      target: (enemy, dt) => this.queries.pickTarget(enemy, dt) || services.player(),
      kill: (enemy, impact) => this.kill(enemy, impact),
    });
    this.actorServices = {
      environment: {
        scene: services.scene,
        resources: services.resources,
        world: services.world,
        navigation: services.navigation,
      },
      feedback: {
        effects: services.effects,
        audio: services.audio,
        hud: services.hud,
        input: services.input,
        boss: bossFeedback,
      },
      policy: {
        present: (ref) => this.byId.get(ref.id) === ref,
        mirror: () => this.mirror,
        damageModifier: () => this.mods.damage,
        speedModifier: () => this.mods.speed,
        localSpeed: () => services.player().speed,
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
        shieldBroken: () => this.lifecycle.shieldBroken(),
        hitstop: (duration, scale) => services.hitstop(duration, scale),
        explode: (ref, scale) => {
          const actor = this.resolveActor(ref);
          if (actor) this.lifecycle.explode(actor, scale);
        },
        emit: (ref, position, direction, shot) => {
          const owner = this.resolveActor(ref);
          if (owner) this.projectiles.fire(position, direction, { ...shot, owner });
        },
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
        world: services.world,
        player: services.player,
        targets: () => this.targets(),
        allocateId: () => this.population.allocateId(),
        authoritative: () => !this.mirror,
        queries: this.queries,
        damage: (enemy, amount, hit) => this.damage(enemy, amount, hit),
        blast: (point, radius, damage, except) => this.blastEnemies(point, radius, damage, except),
        effects: services.effects,
        audio: services.audio,
      },
      new ProjectileView(services.scene, 240),
    );
    this.playback = new EnemyPlayback(
      () => this.enemies,
      (enemy, dt, now) => this.replication.interpolate(enemy, dt, now),
    );
  }
  private resolveActor(ref: EnemyActorRef): EnemyActor | null {
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
    return this.services.targets ? this.services.targets() : [this.services.player()];
  }
  nearestTarget(pos: THREE.Vector3) {
    return this.queries.nearestTarget(pos);
  }
  clear() {
    this.population.clear(this.releaseEntity);
    this.projectiles.clear();
    this.replication.clear();
  }
  spawn(type: EnemyKind, pos: THREE.Vector3, id: number | null = null) {
    const e = new EnemyActor(type, pos, this.slot++, this.actorServices),
      T = e.T;
    e.id = id ?? this.population.allocateId();
    e.body.alwaysStep = true;
    if (T.flying) e.body.noSnap = true;
    e.root.position.copy(pos);
    e.root.scale.setScalar(0.001);
    this.services.scene.add(e.root);
    this.services.resources.track(e.root);
    this.population.add(e);
    if (this.onSpawn && !this.mirror) this.onSpawn(e);
    this.services.effects.strokeBurst(
      pos.clone().add(this.offset.set(0, 1, 0)),
      T.ink ?? INK.RED,
      T.boss ? 60 : 26,
      T.boss ? 10 : 6,
      { life: 0.5, size: 0.03 },
    );
    this.services.audio.spawn(pos);
    if (T.boss) {
      this.services.audio.bossRoar(pos);
      if (this.onBoss) this.onBoss(e);
    }
    return e;
  }
  count(kind: EnemyKind) {
    return this.population.count(kind);
  }
  spawnReady(kind: EnemyKind, position: THREE.Vector3) {
    const enemy = this.spawn(kind, position);
    enemy.state = 'hunt';
    enemy.root.scale.setScalar(enemy.T.scale);
  }
  nearestVisible(from: THREE.Vector3, forward: THREE.Vector3, cosHalf: number, maxDist: number) {
    return this.queries.nearestVisible(from, forward, cosHalf, maxDist);
  }
  raycast(o: THREE.Vector3, d: THREE.Vector3, maxDist: number, ignore: EnemyActor | null = null) {
    return this.queries.raycast(o, d, maxDist, ignore);
  }
  inArc(pos: THREE.Vector3, dir: THREE.Vector3, range: number, cosHalf: number) {
    return this.queries.inArc(pos, dir, range, cosHalf);
  }
  blastEnemies(
    point: THREE.Vector3,
    radius: number,
    damage: number,
    except: EnemyActor | null = null,
  ) {
    this.areaDamage.blast(point, radius, damage, except);
  }
  yank(e: EnemyActor, target: THREE.Vector3) {
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
    this.direction.subVectors(target, e.body.pos);
    const dist = this.direction.length();
    this.direction.divideScalar(Math.max(dist, 0.01));
    e.body.vel.copy(this.direction).multiplyScalar(clamp(dist * 1.6, 10, 26));
    e.body.vel.y = clamp(dist * 0.5, 4, 9);
    e.body.onGround = false;
    this.services.effects.blood(e.center, this.direction, 0.4);
  }
  damage(e: EnemyActor, amount: number, info: EnemyImpact) {
    e.combat.damage(amount, info);
  }
  kill(enemy: EnemyActor, impact: EnemyImpact, notify = true) {
    this.lifecycle.kill(enemy, impact, notify);
  }
  eye(e: EnemyActor, out: THREE.Vector3) {
    return e.eye(out);
  }
  update(dt: number) {
    if (this.mirror)
      this.playback.update(dt, performance.now() / 1000, this.services.player().center);
    else this.simulation.update(dt);
    this.projectiles.update(dt);
    this.population.retire(9, this.releaseEntity);
  }
  // --- network mirror ---
  // Compact per-enemy state the host sends every few frames; clients ease toward it.
  snapshot() {
    return this.replication.snapshot();
  }
  applySnapshot(rows: readonly EnemySnapshot[], now: number) {
    this.replication.apply(rows, now);
  }
  // the host tells us someone died; run the gore without touching scores
  killMirror(id: number, impact: MirroredEnemyDeath) {
    this.lifecycle.killMirror(id, impact);
  }
}
