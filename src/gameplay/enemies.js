// Enemies: doodle humanoids (asdf-style stick figures with faces), flyers, bombers, shield bearers and a boss.
import * as THREE from 'three';
import { makeInkMaterial, setFill } from '../presentation/ink/materials.js';
import { INK } from '../shared/ink.js';
import { makeBody, SEE_THROUGH } from '../engine/physics.js';
import { rand, randInt, clamp, damp, angleLerp, TAU } from '../engine/math.js';

const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

import { TYPES, STATE_CODES, STATE_NAMES } from '../domain/enemies.js';
import { buildHumanoid, buildBomber, buildFlyer } from '../presentation/models/characters.js';
import { createRangedAttack } from './enemies/ranged-attack.js';
import { BladeBehavior } from './enemies/blade-behavior.js';
import { EnemySlash } from '../presentation/characters/melee-slash.js';
import { EnemyPerception } from './enemies/perception.js';
import { BomberBehavior } from './enemies/bomber-behavior.js';
import { drawEnemySeed } from './enemies/seed.js';
import { createRangedBehavior } from './enemies/ranged-behavior.js';
import { EnemyNavigation } from './enemies/navigation.js';
import { EnemyQueries } from './enemies/queries.js';
import { ProjectileView } from '../presentation/projectiles.js';
import { WalkerAnimation } from '../presentation/characters/walker-animation.js';
import { FlyerAnimation } from '../presentation/characters/flyer-animation.js';
import { animationFrame } from '../presentation/characters/animation-contracts.js';
import { EnemyLaser } from '../presentation/characters/laser.js';
import { DeathPose } from '../presentation/characters/death-pose.js';
import { Projectiles } from './projectiles.js';
export { BOSSES } from '../domain/waves.js';
export { TYPES, STATE_CODES, STATE_NAMES } from '../domain/enemies.js';

export class EnemyManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.enemies = [];
    this.queries = new EnemyQueries(
      () => this.enemies,
      () => this.targets(),
      ctx.world,
    );
    this.alive = 0;
    this.projectiles = new Projectiles(
      {
        world: ctx.world,
        player: () => ctx.player,
        targets: () => this.targets(),
        allocateId: () => this.nextId++,
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
    this._sepT = 0;
    this._slot = 0;
    this.mods = { speed: 1, damage: 1 };
    // mirror mode: this peer is a client; the host owns AI, physics and health, we only render
    this.mirror = false;
    this.nextId = 1;
    this.onClientHit = null;
    this.onSpawn = null;
    this.byId = new Map();
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
    for (const e of this.enemies) {
      this._removeLaser(e);
      if (!e.rootDetached) this.ctx.resources.release(e.root);
    }
    this.enemies.length = 0;
    this.alive = 0;
    this.byId.clear();
    this.projectiles.clear();
  }
  spawn(type, pos, id = null) {
    const T = TYPES[type];
    const ink = T.ink ?? INK.RED;
    const mat = makeInkMaterial({ ink, shadeScale: 0, shadeBias: 1 });
    const solid = makeInkMaterial({
      ink: T.ink === INK.BLACK ? INK.RED : INK.BLACK,
      fill: true,
      side: THREE.DoubleSide,
    });
    const model =
      T.model === 'bomber'
        ? buildBomber(mat, solid, T)
        : T.model === 'blob'
          ? buildBomber(mat, solid, T, true)
          : T.model === 'flyer'
            ? buildFlyer(mat, solid, T)
            : buildHumanoid(mat, solid, T);
    const hw = T.flying ? 0.45 : Math.min(0.33 * T.scale, 0.9);
    const body = makeBody(pos, hw, (T.flying ? 0.8 : 1.85) * T.scale, T.boss ? 1.2 : 0.6);
    const seed = drawEnemySeed();
    const e = {
      type,
      T,
      mat,
      root: model.root,
      parts: model.parts,
      J: model.J,
      tip: model.tip,
      face: model.face,
      hit: model.hit,
      hp: T.hp,
      maxHp: T.hp,
      alive: true,
      state: 'spawn',
      t: 0,
      body,
      center: new THREE.Vector3(),
      yaw: seed.yaw,
      animation: T.flying
        ? new FlyerAnimation(model.J, seed.animationPhase)
        : new WalkerAnimation(T, model.J, seed.animationPhase),
      aimAmt: 0,
      flinch: 0,
      flashT: 0,
      flashOn: false,
      clock: { remaining: seed.cooldown },
      stunDur: 0,
      deadT: 0,
      navigation: new EnemyNavigation(
        body,
        { world: this.ctx.world, navigation: () => this.ctx.nav, speed: () => this.mods.speed },
        { weapon: T.weapon, angle: this._slot++ * 2.39996, delay: seed.formationDelay },
      ),
      hitSpheres: model.hit.map(() => new THREE.Vector3()),
      shieldHp: T.shield ? 2 : 0,
      flyState: 'orbit',
      flyT: seed.flyDuration,
      orbitDir: seed.orbitDirection,
      bossAtk: null,
      rootDetached: false,
    };
    e.telegraph = new EnemyLaser(this.ctx.scene, this.ctx.resources);
    e.perception = new EnemyPerception(e.body.pos, (out) => this.eye(e, out), this.ctx.world);
    e.bomber =
      T.weapon === 'bomb'
        ? new BomberBehavior(T, e.body, e.navigation, {
            flash: () => {
              e.flashT = 0.02;
              if (!e.flashOn) {
                setFill(e.mat, true);
                e.flashOn = true;
              }
            },
            fuse: () => this.ctx.audio.fuse(e.center),
            explode: () => this._explodeBomber(e),
          })
        : null;
    e.slash = T.weapon === 'blade' ? new EnemySlash(this.ctx.effects) : null;
    e.blade =
      T.weapon === 'blade'
        ? new BladeBehavior(T, e.body, e.navigation, e.clock, {
            center: e.center,
            damageModifier: () => this.mods.damage,
            audio: this.ctx.audio,
            slash: () => e.slash.draw(e.center, e.yaw),
            stun: (duration) => {
              e.state = 'stunned';
              e.t = 0;
              e.stunDur = duration;
            },
          })
        : null;
    e.ranged = createRangedAttack(T, e.tip, e.clock, {
      center: e.center,
      damageModifier: () => this.mods.damage,
      laser: e.telegraph,
      audio: this.ctx.audio,
      effects: this.ctx.effects,
      emit: (position, direction, bullet) =>
        this.projectiles.fire(position, direction, { ...bullet, owner: e }),
    });
    e.rangedBehavior = createRangedBehavior(T, e.body, e.navigation, {
      attack: e.ranged,
      localSpeed: () => this.ctx.player.speed,
      keepMultiplier: seed.keepMultiplier,
      strafeDirection: seed.strafeDirection,
      strafeDuration: seed.strafeDuration,
    });
    e.animationFrame = animationFrame(e.body.vel, e.center);
    e.id = id ?? this.nextId++;
    this.byId.set(e.id, e);
    e.body.alwaysStep = true;
    if (T.flying) e.body.noSnap = true;
    e.root.position.copy(pos);
    e.root.scale.setScalar(0.001);
    this.ctx.scene.add(e.root);
    this.ctx.resources.track(e.root);
    this.enemies.push(e);
    this.alive++;
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
  nearestVisible(from, forward, cosHalf, maxDist) {
    return this.queries.nearestVisible(from, forward, cosHalf, maxDist);
  }
  raycast(o, d, maxDist, ignore = null) {
    return this.queries.raycast(o, d, maxDist, ignore);
  }
  inArc(pos, dir, range, cosHalf) {
    return this.queries.inArc(pos, dir, range, cosHalf);
  }
  blastEnemies(point, radius, dmg, except) {
    for (const e of this.enemies) {
      if (!e.alive || e === except) continue;
      const d = e.center.distanceTo(point);
      if (d > radius) continue;
      _d.subVectors(e.center, point).normalize();
      this.damage(e, dmg * (1 - (d / radius) * 0.6), {
        point: e.center.clone(),
        dir: _d.clone(),
        part: 'torso',
        source: 'blast',
        crit: false,
      });
    }
  }
  yank(e, target) {
    if (!e.alive) return;
    if (e.T.boss) {
      e.flinch = 1;
      return;
    }
    e.state = 'stunned';
    e.t = 0;
    e.stunDur = 1.3;
    e.navigation.invalidate();
    e.flyState = 'stunned';
    _d.subVectors(target, e.body.pos);
    const dist = _d.length();
    _d.divideScalar(Math.max(dist, 0.01));
    e.body.vel.copy(_d).multiplyScalar(clamp(dist * 1.6, 10, 26));
    e.body.vel.y = clamp(dist * 0.5, 4, 9);
    e.body.onGround = false;
    this.ctx.effects.blood(e.center, _d, 0.4);
  }
  damage(e, amount, info) {
    if (!e.alive) return;
    if (this.mirror) {
      // show the hit right away, let the host decide what it did
      if (info.part !== 'shield') {
        e.flinch = 1;
        e.flashT = 0.07;
        if (!e.flashOn) {
          setFill(e.mat, true);
          e.flashOn = true;
        }
        this.ctx.effects.blood(
          info.point || e.center,
          info.dir || _up,
          clamp(0.5 + amount / 70, 0.5, 2.2),
          { ink: e.T.ink === INK.BLACK ? INK.BLACK : INK.RED },
        );
        this.ctx.hud.hitmarker(false, info.crit);
      }
      if (this.onClientHit) this.onClientHit(e, amount, info);
      return;
    }
    if (info.part === 'shield') {
      this.ctx.effects.sparks(
        info.point,
        info.dir ? info.dir.clone().negate() : _up,
        INK.ORANGE,
        8,
        8,
      );
      this.ctx.audio.shieldHit(info.point);
      if (info.source === 'katana' || info.source === 'blast') {
        e.shieldHp--;
        if (e.shieldHp <= 0) this._breakShield(e);
      }
      this.ctx.hud.hitmarker(false, false);
      return;
    }
    amount *= this.mods.damage;
    e.hp -= amount;
    e.flinch = 1;
    e.flashT = 0.07;
    if (!e.flashOn) {
      setFill(e.mat, true);
      e.flashOn = true;
    }
    const dir = info.dir || _d.set(0, 1, 0);
    const amt = clamp(0.5 + amount / 70, 0.5, 2.2) * (e.T.boss ? 1.6 : 1);
    this.ctx.effects.blood(info.point || e.center, dir, amt, {
      ink: e.T.ink === INK.BLACK ? INK.BLACK : INK.RED,
    });
    if (info.crit) this.ctx.audio.headshot(e.center);
    else this.ctx.audio.hitEnemy(e.center);
    this.ctx.hud.hitmarker(e.hp <= 0, info.crit);
    if (info.source !== 'deflect') this.ctx.input.rumble(0.1, 0.3, 30);
    if (e.state === 'spawn') {
      e.state = 'hunt';
      e.root.scale.setScalar(e.T.scale);
    }
    if (e.T.boss && this.onBoss) this.onBoss(e);
    if (e.hp <= 0) {
      this.ctx.game.hitstop(info.crit ? 0.05 : 0.025, 0.25);
      this.kill(e, info);
    }
  }
  _breakShield(e) {
    const g = e.J.shieldG;
    if (!g || !g.parent) return;
    g.updateWorldMatrix(true, false);
    this.ctx.scene.attach(g);
    this.ctx.effects.debris(
      g,
      g.position,
      new THREE.Vector3(rand(-3, 3), 4, rand(-3, 3)),
      new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      { radius: 0.4, blood: false, life: 8 },
    );
    e.hit = e.hit.filter((h) => h[0] !== 'shield');
    e.hitSpheres = e.hit.map(() => new THREE.Vector3());
    e.J.shieldG = null;
    this.ctx.audio.shieldHit(e.center);
    this.ctx.game.addScore(40, 'SHIELD BROKEN');
  }
  kill(e, info) {
    e.alive = false;
    e.state = 'dead';
    e.deadT = 0;
    this.alive--;
    e.body.vel.set(0, 0, 0);
    this._removeLaser(e);
    const eff = this.ctx.effects,
      scene = this.ctx.scene;
    const inkC = e.T.ink === INK.BLACK ? INK.BLACK : INK.RED;
    if (e.face) {
      e.face.eyes.visible = false;
      e.face.xeyes.visible = true;
    }
    const dir = (info.dir || _d.set(0, 0.5, 0)).clone().normalize();
    if (e.T.weapon === 'bomb') {
      this._explodeBomber(e, 0.8);
      if (this.onKill) this.onKill(e, info, true);
      return;
    }
    this.ctx.audio.enemyDie(e.center);
    if (e.T.flying) {
      e.root.updateWorldMatrix(true, false);
      scene.attach(e.root);
      e.rootDetached = true;
      eff.debris(
        e.root,
        e.root.position,
        dir
          .clone()
          .multiplyScalar(4)
          .add(_v.set(rand(-2, 2), 1, rand(-2, 2))),
        new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
        { radius: 0.5, blood: true, life: 8 },
      );
      eff.blood(e.center, dir, 1);
      if (this.onKill) this.onKill(e, info, true);
      return;
    }
    const over =
      -e.hp > e.maxHp * 0.35 ||
      info.source === 'katana' ||
      info.crit ||
      info.source === 'deflect' ||
      info.source === 'blast';
    const detach = (obj, extraVel, radius) => {
      if (!obj || !obj.parent) return;
      obj.updateWorldMatrix(true, false);
      scene.attach(obj);
      _v.copy(dir).multiplyScalar(rand(3, 7)).add(extraVel);
      _v.y += rand(2, 5);
      eff.debris(obj, obj.position, _v, new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), {
        radius,
        blood: true,
        life: rand(7, 10),
      });
    };
    if (over) {
      this.ctx.audio.gib(e.center);
      const J = e.J;
      if (
        info.crit ||
        ((info.source === 'katana' || info.source === 'focus') && Math.random() < 0.35)
      ) {
        detach(J.headG, _v2.set(rand(-2, 2), 3, rand(-2, 2)), 0.25);
        eff.fountain(
          e.parts.torso.getWorldPosition(new THREE.Vector3()).add(_v2.set(0, 0.35, 0)),
          _up,
          0.9,
          inkC,
        );
      }
      if (info.source === 'katana' || info.source === 'focus') {
        const r = Math.random();
        if (r < 0.4) detach(J.armR, _v2.set(rand(-3, 3), 2, rand(-3, 3)), 0.12);
        else if (r < 0.7) detach(J.armL, _v2.set(rand(-3, 3), 2, rand(-3, 3)), 0.12);
        else {
          detach(J.torso, _v2.set(rand(-2, 2), 2, rand(-2, 2)), 0.3);
          const hips = e.parts.hips ?? J.hips;
          eff.fountain(hips.getWorldPosition(new THREE.Vector3()), _up, 0.7, inkC);
        }
      } else if (info.source === 'deflect' || info.source === 'blast' || -e.hp > e.maxHp * 0.6) {
        const limbs = [J.armL, J.armR, J.legL, J.legR, J.torso];
        const k = e.T.boss ? 5 : randInt(1, 2);
        for (let i = 0; i < k && limbs.length; i++) {
          const o = limbs.splice(randInt(0, limbs.length - 1), 1)[0];
          detach(o, _v2.set(rand(-3, 3), 2, rand(-3, 3)), 0.15);
        }
      }
    }
    e.deathPose = new DeathPose(e.root, e.J.hips.parent, {
      axis: Math.random() < 0.5 ? 'x' : 'z',
      sign: dir.z > 0 || Math.random() < 0.5 ? 1 : -1,
    });
    eff.bloodPool(e.body.pos, rand(1.1, 1.8) * (e.T.boss ? 2.5 : 1), inkC);
    eff.blood(e.center, dir, 1.2, { ink: inkC });
    if (Math.random() < 0.6 && e.J.gun && e.J.gun.parent)
      detach(e.J.gun, _v2.set(rand(-2, 2), 2, rand(-2, 2)), 0.08);
    if (e.J.shieldG) this._breakShield(e);
    if (e.T.boss) {
      eff.explosion(e.center, 6, INK.BLACK);
      this.ctx.audio.explosion(e.center);
      if (this.onBoss) this.onBoss(e);
    }
    if (this.onKill) this.onKill(e, info, over);
  }
  _explodeBomber(e, scale = 1) {
    const T = e.T;
    const c = e.center.clone();
    this.ctx.effects.explosion(c, T.blast * scale, INK.BLACK);
    this.ctx.audio.explosion(c);
    for (const P of this.targets()) {
      const d = P.center.distanceTo(c);
      if (P.alive && d < T.blast * scale) {
        P.takeDamage(T.dmg * this.mods.damage * Math.sqrt(1 - d / (T.blast * scale)), c);
        P.knockback(_v.subVectors(P.center, c).normalize(), 7);
      }
    }
    this.blastEnemies(c, T.blast * scale, 70, e);
    if (e.alive) {
      e.alive = false;
      e.state = 'dead';
      this.alive--;
      if (this.onKill) this.onKill(e, { source: 'blast', dir: _up.clone() }, true);
    }
    this.ctx.resources.release(e.root);
    e.rootDetached = true;
    e.deadT = 99;
  }
  eye(e, out) {
    return out.setFromMatrixPosition(e.parts.head.matrixWorld);
  }
  update(dt) {
    if (this.mirror) {
      this._updateMirror(dt);
      return;
    }
    const ctx = this.ctx,
      world = ctx.world;
    for (const e of this.enemies) {
      e.t += dt;
      if (!e.alive) {
        this._updateDead(e, dt);
        continue;
      }
      const P = this._pickTarget(e, dt) || ctx.player;
      const pp = P.body.pos,
        pc = P.center;
      if (e.flashT > 0) {
        e.flashT -= dt;
        if (e.flashT <= 0 && e.flashOn) {
          setFill(e.mat, false);
          e.flashOn = false;
        }
      }
      e.flinch = damp(e.flinch, 0, 9, dt);
      if (e.state === 'spawn') {
        const f = clamp(e.t / 0.6, 0, 1);
        e.root.scale.setScalar(
          Math.max(0.001, f * e.T.scale * (1 + Math.sin(e.t * 60) * 0.12 * (1 - f))),
        );
        e.root.position.copy(e.body.pos);
        e.root.rotation.y = e.yaw;
        this._syncHit(e);
        if (e.t >= 0.6) {
          e.state = 'hunt';
          e.root.scale.setScalar(e.T.scale);
        }
        continue;
      }
      if (e.state === 'stunned') this._hideLaser(e);
      if (e.T.flying) {
        this._thinkFlyer(e, dt, pc, P);
        world.moveBody(e.body, dt);
      } else {
        if (e.state === 'stunned') {
          if (e.t > e.stunDur) e.state = 'hunt';
        } else if (P.alive) this._think(e, dt, pp, pc, P);
        else this._wander(e, dt);
        e.body.vel.y -= 24 * dt;
        world.moveBody(e.body, dt);
      }
      if (e.body.pos.y < -6) {
        this.kill(e, { source: 'fall', dir: _up.clone() });
        continue;
      }
      e.yaw = angleLerp(e.yaw, e.navigation.heading, 1 - Math.exp(-10 * dt));
      e.root.position.copy(e.body.pos);
      e.root.rotation.y = e.yaw;
      // never let a body occupy the same space as the player
      if (!e.T.flying) {
        const pr = 0.36 + e.body.halfW + 0.12;
        const ox = e.body.pos.x - pp.x,
          oz = e.body.pos.z - pp.z;
        const o2 = ox * ox + oz * oz;
        if (o2 < pr * pr && Math.abs(e.body.pos.y - pp.y) < 1.7) {
          const od = Math.sqrt(o2) || 0.0001;
          const push = pr - od;
          e.body.pos.x += (ox / od) * push;
          e.body.pos.z += (oz / od) * push;
          if (world.overlapsBody(e.body)) {
            e.body.pos.x -= (ox / od) * push;
            e.body.pos.z -= (oz / od) * push;
          }
        }
      }
      this._animate(e, dt, pc);
      this._syncHit(e);
    }
    this._separate(dt);
    this.projectiles.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.deadT > 9) {
        this._removeLaser(e);
        if (!e.rootDetached) this.ctx.resources.release(e.root);
        this.enemies.splice(i, 1);
        this.byId.delete(e.id);
      }
    }
  }
  // --- network mirror ---
  // Compact per-enemy state the host sends every few frames; clients ease toward it.
  snapshot() {
    const out = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const b = e.body;
      out.push([
        e.id,
        +b.pos.x.toFixed(2),
        +b.pos.y.toFixed(2),
        +b.pos.z.toFixed(2),
        +e.yaw.toFixed(2),
        STATE_CODES[e.state] ?? 1,
        Math.round(e.hp),
        +(e.rangedBehavior?.aimAmt ?? e.aimAmt).toFixed(2),
        +(e.blade?.attackT ?? 0).toFixed(2),
        (e.bomber?.fuseT ?? -1) >= 0 ? 1 : 0,
        e.bossAtk ? 1 : 0,
      ]);
    }
    return out;
  }
  applySnapshot(arr, now) {
    for (const r of arr) {
      const e = this.byId.get(r[0]);
      if (!e || !e.alive) continue;
      e.snapA = e.snapB || { p: e.body.pos.clone(), yaw: e.yaw, t: now - 0.08 };
      e.snapB = { p: new THREE.Vector3(r[1], r[2], r[3]), yaw: r[4], t: now };
      const st = STATE_NAMES[r[5]] || 'hunt';
      if (e.state === 'spawn' && st !== 'spawn') {
        e.state = st;
        e.root.scale.setScalar(e.T.scale);
      } else if (e.state !== 'spawn') e.state = st;
      e.hp = r[6];
      if (e.rangedBehavior) e.rangedBehavior.applyAim(r[7]);
      else e.aimAmt = r[7];
      e.blade?.applyAttackTime(r[8]);
      e.bomber?.applyFuse(r[9] ? 0.5 : -1);
      e.bossAtk = r[10] ? e.bossAtk || { kind: 'stomp', t: 0.3 } : null;
      if (e.T.boss && this.onBoss) this.onBoss(e);
    }
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
      if (e.flashT > 0) {
        e.flashT -= dt;
        if (e.flashT <= 0 && e.flashOn) {
          setFill(e.mat, false);
          e.flashOn = false;
        }
      }
      e.flinch = damp(e.flinch, 0, 9, dt);
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
      if (e.snapA && e.snapB) {
        // render 100 ms behind the newest snapshot so movement stays smooth between packets
        const span = Math.max(0.02, e.snapB.t - e.snapA.t);
        const k = clamp((now - 0.1 - e.snapA.t) / span, 0, 1.2);
        _v.lerpVectors(e.snapA.p, e.snapB.p, k);
        e.body.vel.subVectors(_v, e.body.pos).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 30);
        e.body.pos.copy(_v);
        e.body.onGround = Math.abs(e.body.vel.y) < 0.5;
        e.yaw = angleLerp(e.snapA.yaw, e.snapB.yaw, k);
      }
      e.root.position.copy(e.body.pos);
      e.root.rotation.y = e.yaw;
      this._animate(e, dt, P.center);
      if (e.T.weapon === 'sniper')
        e.telegraph.setVisible((e.rangedBehavior?.aimAmt ?? e.aimAmt) > 0.9);
      this._syncHit(e);
    }
    this.projectiles.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.deadT > 9) {
        this._removeLaser(e);
        if (!e.rootDetached) this.ctx.resources.release(e.root);
        this.byId.delete(e.id);
        this.enemies.splice(i, 1);
        this.byId.delete(e.id);
      }
    }
  }
  // the host tells us someone died; run the gore without touching scores
  killMirror(id, info) {
    const e = this.byId.get(id);
    if (!e || !e.alive) return;
    const cb = this.onKill;
    this.onKill = null;
    this.kill(e, {
      ...info,
      dir: info.dir ? new THREE.Vector3().fromArray(info.dir) : _up.clone(),
      point: info.point ? new THREE.Vector3().fromArray(info.point) : e.center.clone(),
    });
    this.onKill = cb;
  }
  _syncHit(e) {
    e.root.updateMatrixWorld(true);
    for (let i = 0; i < e.hit.length; i++)
      e.hitSpheres[i].setFromMatrixPosition(e.parts[e.hit[i][0]].matrixWorld);
    e.center.setFromMatrixPosition(e.parts.torso.matrixWorld);
  }
  _updateDead(e, dt) {
    e.deadT += dt;
    if (!e.rootDetached) e.deathPose?.update(dt, e.deadT, e.T.scale, e.yaw);
  }
  _separate(dt) {
    this._sepT -= dt;
    if (this._sepT > 0) return;
    this._sepT = 0.05;
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (!a.alive || a.T.flying) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (!b.alive || b.T.flying) continue;
        const dx = b.body.pos.x - a.body.pos.x,
          dz = b.body.pos.z - a.body.pos.z;
        const d2 = dx * dx + dz * dz;
        const rr = a.body.halfW + b.body.halfW + 0.75;
        if (d2 > rr * rr || d2 < 1e-6 || Math.abs(b.body.pos.y - a.body.pos.y) > 1.5) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) * 9;
        a.body.vel.x -= (dx / d) * push;
        a.body.vel.z -= (dz / d) * push;
        b.body.vel.x += (dx / d) * push;
        b.body.vel.z += (dz / d) * push;
      }
    }
  }
  _steer(e, dt, gx, gz, speed, accel) {
    const yaw = e.navigation.steer(gx, gz, speed, accel, dt);
    if (yaw !== null) e.navigation.heading = yaw;
  }

  _follow(e, dt, target, speed) {
    const yaw = e.navigation.follow(dt, target, speed);
    if (yaw !== null) e.navigation.heading = yaw;
  }
  _wander(e, dt) {
    if (e.rangedBehavior) {
      e.rangedBehavior.idle(dt);
      return;
    }
    e.body.vel.x = damp(e.body.vel.x, 0, 6, dt);
    e.body.vel.z = damp(e.body.vel.z, 0, 6, dt);
    e.aimAmt = damp(e.aimAmt, 0, 5, dt);
  }
  _think(e, dt, pp, pc, P) {
    const T = e.T;
    const sensed = e.perception.update(dt, P);
    const { distance: dist, height: dy, yaw: yawTo } = sensed;
    e.clock.remaining -= dt;
    if (T.weapon === 'bomb') {
      e.bomber.update(dt, sensed);
      return;
    }
    if (T.weapon === 'blade') {
      e.aimAmt = damp(e.aimAmt, 0, 8, dt);
      e.blade.update(dt, sensed, P);
      return;
    }
    if (T.weapon === 'boss') {
      this._thinkBoss(e, dt, pp, pc, dist, dy, yawTo, P);
      return;
    }
    e.rangedBehavior.update(dt, sensed, P.speed, e.t);
  }
  _thinkBoss(e, dt, pp, pc, dist, dy, yawTo, P) {
    const T = e.T,
      b = e.body,
      ctx = this.ctx;
    if (T.bossKind === 'eraser') return this._thinkEraser(e, dt, pp, pc, dist, dy, yawTo, P);
    if (T.bossKind === 'inkblot') return this._thinkInkblot(e, dt, pp, pc, dist, dy, yawTo, P);
    if (e.bossAtk) {
      const a = e.bossAtk;
      a.t += dt;
      e.navigation.heading = yawTo;
      b.vel.x = damp(b.vel.x, 0, 5, dt);
      b.vel.z = damp(b.vel.z, 0, 5, dt);
      if (a.kind === 'stomp') {
        if (a.t > 0.75 && !a.done) {
          a.done = true;
          this.ctx.audio.stomp(e.center);
          ctx.effects.shakeAmt += 0.9;
          ctx.effects.explosion(b.pos.clone().add(_v.set(0, 0.2, 0)), 7, INK.BLACK);
          for (let i = 0; i < 24; i++) {
            const an = (i / 24) * TAU;
            _v.set(b.pos.x + Math.cos(an) * 3, b.pos.y + 0.3, b.pos.z + Math.sin(an) * 3);
            _v2.set(Math.cos(an) * 14, 2, Math.sin(an) * 14);
            ctx.effects.particle('stroke', _v, _v2, {
              size: 0.06,
              life: 0.4,
              ink: INK.BLACK,
              gravity: 4,
              stretch: 0.06,
              drag: 3,
            });
          }
          for (const t of this.targets()) {
            const dd = Math.hypot(t.body.pos.x - b.pos.x, t.body.pos.z - b.pos.z);
            if (t.alive && dd < 7.5 && t.body.pos.y < b.pos.y + 2.5) {
              t.takeDamage(T.dmg * this.mods.damage, e.center);
              t.knockback(_d.subVectors(t.center, e.center).normalize(), 9);
            }
          }
          this.blastEnemies(b.pos, 6, 60, e);
        }
        if (a.t > 1.3) {
          e.bossAtk = null;
          e.clock.remaining = rand(T.cool[0], T.cool[1]);
        }
      } else {
        if (a.t > 0.6 && !a.done) {
          a.done = true;
          _v.setFromMatrixPosition(e.parts.head.matrixWorld);
          _v.y += 1;
          _d.subVectors(pc, _v);
          const l = _d.length();
          _d.divideScalar(l);
          _d.y += l * 0.012;
          _d.normalize();
          this.projectiles.fire(_v, _d, {
            speed: 24,
            damage: T.dmg * 0.9,
            owner: e,
            ink: INK.BLACK,
            thickness: 0.4,
            blast: 1,
          });
          this.ctx.audio.enemyShot(e.center);
        }
        if (a.t > 1.0) {
          e.bossAtk = null;
          e.clock.remaining = rand(T.cool[0] * 0.6, T.cool[1] * 0.6);
        }
      }
      return;
    }
    e.aimAmt = damp(e.aimAmt, e.perception.visible ? 1 : 0, 6, dt);
    if (e.clock.remaining <= 0 && e.perception.visible) {
      if (dist < 7 && Math.abs(dy) < 3) {
        e.bossAtk = { kind: 'stomp', t: 0, done: false };
        this.ctx.audio.bossRoar(e.center);
        return;
      }
      if (dist < T.range) {
        e.bossAtk = { kind: 'throw', t: 0, done: false };
        return;
      }
    }
    if (e.perception.visible && dist < 14 && Math.abs(dy) < 2)
      this._steer(e, dt, pp.x, pp.z, T.speed, 30);
    else this._follow(e, dt, pp, T.speed);
    if (e.perception.visible) e.navigation.heading = yawTo;
  }
  // THE ERASER: a rubber brick that charges across the ground, then scrubs the page and calls
  // in bombers. It wants to be close; keep moving and it skids past you.
  _thinkEraser(e, dt, pp, pc, dist, dy, yawTo, P) {
    const T = e.T,
      b = e.body,
      ctx = this.ctx;
    e.aimAmt = damp(e.aimAmt, 0, 6, dt);
    if (e.bossAtk) {
      const a = e.bossAtk;
      a.t += dt;
      if (a.kind === 'charge') {
        if (a.t < 0.7) {
          e.navigation.heading = yawTo;
          b.vel.x = damp(b.vel.x, 0, 8, dt);
          b.vel.z = damp(b.vel.z, 0, 8, dt);
          if (a.t > 0.55 && !a.dir) {
            a.dir = new THREE.Vector3(pp.x - b.pos.x, 0, pp.z - b.pos.z).normalize();
            this.ctx.audio.bossRoar(e.center);
          }
        } else if (a.t < 1.9) {
          b.vel.x = a.dir.x * 17 * this.mods.speed;
          b.vel.z = a.dir.z * 17 * this.mods.speed;
          for (const t of this.targets()) {
            if (!t.alive) continue;
            const d = Math.hypot(t.body.pos.x - b.pos.x, t.body.pos.z - b.pos.z);
            if (d < 2.6 && Math.abs(t.body.pos.y - b.pos.y) < 3 && !a.hit) {
              a.hit = true;
              t.takeDamage(T.dmg * this.mods.damage, e.center);
              t.knockback(_d.subVectors(t.center, e.center).setY(0.2).normalize(), 13);
              ctx.effects.shakeAmt += 0.5;
            }
          }
          if (b.hitWall) {
            a.t = 1.9;
            ctx.effects.strokeBurst(e.center, INK.PINK, 30, 9, { life: 0.4, size: 0.05 });
            this.ctx.audio.stomp(e.center);
            ctx.effects.shakeAmt += 0.6;
          }
          if (Math.floor(a.t * 10) !== Math.floor((a.t - dt) * 10))
            ctx.effects.strokeBurst(b.pos.clone().add(_v.set(0, 0.3, 0)), INK.PINK, 4, 3, {
              life: 0.35,
              size: 0.06,
            });
        } else {
          b.vel.x = damp(b.vel.x, 0, 4, dt);
          b.vel.z = damp(b.vel.z, 0, 4, dt);
          if (a.t > 2.7) {
            e.bossAtk = null;
            e.clock.remaining = rand(T.cool[0], T.cool[1]);
            e.charges = (e.charges || 0) + 1;
          }
        }
      } else {
        e.navigation.heading = yawTo;
        b.vel.x = damp(b.vel.x, 0, 6, dt);
        b.vel.z = damp(b.vel.z, 0, 6, dt);
        if (a.t > 0.9 && !a.done) {
          a.done = true;
          this.ctx.audio.stomp(e.center);
          ctx.effects.shakeAmt += 0.8;
          // scrubs the page clean around itself, and the rubbings get up and walk
          ctx.effects.explosion(b.pos.clone().add(_v.set(0, 0.2, 0)), 6, INK.PINK);
          const live = this.enemies.filter((x) => x.alive && x.type === 'bomber').length;
          for (let i = 0; i < 2 && live + i < 4; i++) {
            const an = rand(0, TAU);
            const sp = this.spawn(
              'bomber',
              b.pos.clone().add(_v.set(Math.cos(an) * 3, 0, Math.sin(an) * 3)),
            );
            sp.state = 'hunt';
            sp.root.scale.setScalar(sp.T.scale);
          }
          for (const t of this.targets()) {
            const d = Math.hypot(t.body.pos.x - b.pos.x, t.body.pos.z - b.pos.z);
            if (t.alive && d < 6.5 && t.body.pos.y < b.pos.y + 3) {
              t.takeDamage(T.dmg * 0.8 * this.mods.damage, e.center);
              t.knockback(_d.subVectors(t.center, e.center).normalize(), 9);
            }
          }
        }
        if (a.t > 1.6) {
          e.bossAtk = null;
          e.clock.remaining = rand(T.cool[0], T.cool[1]);
        }
      }
      return;
    }
    if (e.clock.remaining <= 0 && e.perception.visible) {
      if ((e.charges || 0) % 3 === 2 && dist < 12) {
        e.bossAtk = { kind: 'rub', t: 0, done: false };
        e.charges++;
        return;
      }
      if (dist < T.range && dist > 3) {
        e.bossAtk = { kind: 'charge', t: 0, hit: false, dir: null };
        return;
      }
    }
    if (e.perception.visible && dist < 16 && Math.abs(dy) < 2)
      this._steer(e, dt, pp.x, pp.z, T.speed, 30);
    else this._follow(e, dt, pp, T.speed);
    if (e.perception.visible) e.navigation.heading = yawTo;
  }
  // THE INKBLOT: hops around the arena, sprays fans of bursting ink, and shakes wasps loose.
  _thinkInkblot(e, dt, pp, pc, dist, dy, yawTo, P) {
    const T = e.T,
      b = e.body,
      ctx = this.ctx;
    e.aimAmt = damp(e.aimAmt, e.perception.visible ? 1 : 0, 6, dt);
    if (e.bossAtk) {
      const a = e.bossAtk;
      a.t += dt;
      e.navigation.heading = yawTo;
      b.vel.x = damp(b.vel.x, 0, 6, dt);
      b.vel.z = damp(b.vel.z, 0, 6, dt);
      if (a.kind === 'spray') {
        if (a.t > 0.6 && a.shots < 9 && a.t > 0.6 + a.shots * 0.09) {
          _v.setFromMatrixPosition(e.parts.torso.matrixWorld);
          _v.y += 0.8;
          const base = Math.atan2(pp.x - b.pos.x, pp.z - b.pos.z);
          const an = base + (a.shots - 4) * 0.19;
          _d.set(Math.sin(an), 0.18 + rand(-0.05, 0.05), Math.cos(an)).normalize();
          this.projectiles.fire(_v, _d, {
            speed: 20,
            damage: T.dmg * 0.55 * this.mods.damage,
            owner: e,
            ink: INK.BLACK,
            thickness: 0.3,
            blast: 1,
          });
          a.shots++;
          if (a.shots === 1) this.ctx.audio.enemyShot(e.center);
        }
        if (a.t > 1.8) {
          e.bossAtk = null;
          e.clock.remaining = rand(T.cool[0], T.cool[1]);
          e.sprays = (e.sprays || 0) + 1;
        }
      } else {
        if (a.t > 0.8 && !a.done) {
          a.done = true;
          this.ctx.audio.bossRoar(e.center);
          ctx.effects.strokeBurst(e.center, INK.BLACK, 40, 10, { life: 0.5, size: 0.05 });
          const live = this.enemies.filter((x) => x.alive && x.type === 'flyer').length;
          for (let i = 0; i < 3 && live + i < 6; i++) {
            const sp = this.spawn(
              'flyer',
              e.center.clone().add(_v.set(rand(-2, 2), 2 + i, rand(-2, 2))),
            );
            sp.state = 'hunt';
            sp.root.scale.setScalar(sp.T.scale);
          }
        }
        if (a.t > 1.4) {
          e.bossAtk = null;
          e.clock.remaining = rand(T.cool[0], T.cool[1]);
        }
      }
      return;
    }
    // it moves in hops: a big jump toward you every couple of seconds, a slam of ink on landing
    e.hopT = (e.hopT ?? 1) - dt;
    if (b.onGround && e.hopT <= 0 && dist > 4) {
      e.hopT = rand(1.6, 2.4);
      const nx = (pp.x - b.pos.x) / dist,
        nz = (pp.z - b.pos.z) / dist;
      b.vel.set(nx * 11, 13, nz * 11);
      b.onGround = false;
      e.hopping = true;
    }
    if (e.hopping && b.onGround) {
      e.hopping = false;
      this.ctx.audio.stomp(e.center);
      ctx.effects.shakeAmt += 0.4;
      ctx.effects.bloodPool(b.pos, 3.5, INK.BLACK);
      for (const t of this.targets()) {
        const d = Math.hypot(t.body.pos.x - b.pos.x, t.body.pos.z - b.pos.z);
        if (t.alive && d < 4.5 && Math.abs(t.body.pos.y - b.pos.y) < 2.5) {
          t.takeDamage(T.dmg * 0.7 * this.mods.damage, e.center);
          t.knockback(_d.subVectors(t.center, e.center).normalize(), 8);
        }
      }
    }
    if (e.clock.remaining <= 0 && e.perception.visible) {
      if ((e.sprays || 0) % 3 === 2) {
        e.bossAtk = { kind: 'summon', t: 0, done: false };
        e.sprays++;
        return;
      }
      if (dist < T.range) {
        e.bossAtk = { kind: 'spray', t: 0, shots: 0 };
        return;
      }
    }
    if (!e.hopping) {
      if (e.perception.visible && dist < 14 && Math.abs(dy) < 2)
        this._steer(e, dt, pp.x, pp.z, T.speed, 30);
      else this._follow(e, dt, pp, T.speed);
    }
    if (e.perception.visible) e.navigation.heading = yawTo;
  }
  _thinkFlyer(e, dt, pc, P) {
    const T = e.T,
      b = e.body,
      ctx = this.ctx;
    e.flyT -= dt;
    e.clock.remaining -= dt;
    const want = _v2;
    if (e.flyState === 'stunned') {
      b.vel.y -= 20 * dt;
      if (b.onGround || e.t > 2.2) {
        e.flyState = 'climb';
        e.flyT = 1.2;
        e.state = 'hunt';
      }
    } else if (e.flyState === 'orbit') {
      const ang = Math.atan2(b.pos.x - pc.x, b.pos.z - pc.z) + e.orbitDir * 0.45;
      const rad = 11;
      want.set(
        pc.x + Math.sin(ang) * rad,
        pc.y + 6 + Math.sin(e.t * 1.3) * 1.5,
        pc.z + Math.cos(ang) * rad,
      );
      this._flyTo(e, want, T.speed, 22, dt);
      if (
        e.clock.remaining <= 0 &&
        P.alive &&
        ctx.world.hasLineOfSight(e.center, pc, SEE_THROUGH)
      ) {
        e.flyState = 'dive';
        e.flyT = 1.6;
        e.diveHit = false;
        this.ctx.audio.flyerDive(e.center);
      }
      if (Math.random() < dt * 1.5) this.ctx.audio.flyerBuzz(e.center);
    } else if (e.flyState === 'dive') {
      want.copy(pc);
      this._flyTo(e, want, 16, 28, dt);
      const d = e.center.distanceTo(pc);
      if (d < 1.4 && !e.diveHit) {
        e.diveHit = true;
        if (P.tryBlockMelee(e)) {
          e.flyState = 'stunned';
          e.state = 'stunned';
          e.t = 0;
          b.vel.set(-b.vel.x * 0.3, -3, -b.vel.z * 0.3);
        } else if (P.alive) {
          P.takeDamage(T.dmg * this.mods.damage, e.center);
          P.knockback(_d.copy(b.vel).normalize(), 3);
        }
      }
      if (e.flyT <= 0 || e.diveHit || b.hitWall) {
        e.flyState = 'climb';
        e.flyT = 1.1;
        e.clock.remaining = rand(T.cool[0], T.cool[1]);
      }
    } else {
      want.set(pc.x + (b.pos.x - pc.x) * 1.5, pc.y + 8, pc.z + (b.pos.z - pc.z) * 1.5);
      this._flyTo(e, want, T.speed, 18, dt);
      if (e.flyT <= 0) e.flyState = 'orbit';
    }
    // avoid geometry: look ahead and above the ground
    const sp = b.vel.length();
    if (sp > 0.5) {
      _d.copy(b.vel).divideScalar(sp);
      const h = ctx.world.raycast(e.center, _d, 3.5);
      if (h) {
        b.vel.addScaledVector(h.normal, 14 * dt);
        b.vel.y += 12 * dt;
      }
    }
    const g = ctx.world.raycast(e.center, _v3.set(0, -1, 0), 2.5);
    if (g) b.vel.y += 12 * dt;
    _d.copy(b.vel);
    if (_d.lengthSq() > 0.1) e.navigation.heading = Math.atan2(_d.x, _d.z);
  }
  _flyTo(e, target, speed, accel, dt) {
    const b = e.body;
    _d.subVectors(target, b.pos);
    const l = _d.length();
    if (l < 0.3) {
      b.vel.multiplyScalar(Math.max(0, 1 - 4 * dt));
      return;
    }
    _d.divideScalar(l).multiplyScalar(speed * this.mods.speed);
    _v3.subVectors(_d, b.vel);
    const m = _v3.length();
    if (m > accel * dt) _v3.multiplyScalar((accel * dt) / m);
    b.vel.add(_v3);
  }

  _hideLaser(e) {
    e.telegraph.hide();
  }
  _removeLaser(e) {
    e.telegraph.dispose();
  }

  _animate(e, dt, pc) {
    const pose = e.animationFrame;
    pose.onGround = e.body.onGround;
    pose.yaw = e.yaw;
    pose.time = e.t;
    pose.fuseT = e.bomber?.fuseT ?? -1;
    pose.aimAmt = e.rangedBehavior?.aimAmt ?? e.aimAmt;
    pose.attackT = e.blade?.attackT ?? 0;
    pose.flinch = e.flinch;
    pose.state = e.state;
    pose.flyState = e.flyState;
    pose.bossAtk = e.bossAtk;
    e.animation.update(pose, dt, pc);
  }
}
