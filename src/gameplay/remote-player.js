// Other people in the match. Each is drawn as a doodle figure in a team colour and eased between
// the snapshots its owner sends; it also exposes the same surface enemies and weapons expect of a
// target (body, center, eye, hit spheres, takeDamage) so the rest of the game does not care
// whether it is shooting at a bot or a friend.
import * as THREE from 'three';
import { RemoteGrapple } from '../presentation/remote-grapple.js';
import { RemoteInterpolation } from './remote/interpolation.js';
import { makeInkMaterial, setFill } from '../presentation/ink/materials.js';
import { INK } from '../shared/ink.js';
import { buildHumanoid, buildWeaponProp } from '../presentation/models/characters.js';
import {
  RemoteAnimation,
  remoteAnimationFrame,
} from '../presentation/characters/remote-animation.js';

const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
const WEAPON_KINDS = ['rifle', 'shotgun', 'sniper', 'blade'];
const HIT = [
  ['head', 0.3],
  ['torso', 0.33],
  ['hips', 0.2],
  ['armL', 0.11],
  ['armR', 0.11],
  ['foreL', 0.1],
  ['foreR', 0.1],
  ['legL', 0.13],
  ['legR', 0.13],
  ['shinL', 0.11],
  ['shinR', 0.11],
];

export { encodeLocal } from '../domain/player-snapshots.js';

export class RemotePlayer {
  /**
   * @param {import('./remote/services.js').RemoteServices} services
   * @param {string} id
   * @param {string} name
   * @param {number} team
   * @param {number} ink
   */
  constructor(services, id, name, team, ink) {
    this.services = services;
    this.id = id;
    this.name = name || 'paper';
    this.team = team;
    this.ink = ink;
    this.isLocal = false;
    this.alive = true;
    this.parryWindow = false;
    this.idle = false;
    this.idleSince = 0;
    this.untouched = false;
    this.away = false;
    this.hp = 100;
    this.maxHp = 100;
    this.speed = 0;
    this.weaponIndex = 0;
    this.body = {
      pos: new THREE.Vector3(0, -50, 0),
      vel: new THREE.Vector3(),
      halfW: 0.35,
      height: 1.75,
      onGround: true,
    };
    this.center = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.crouching = false;
    this.sliding = false;
    this.blocking = false;
    this.aiming = false;
    this.firing = false;
    this.animation = new RemoteAnimation();
    this.animationFrame = remoteAnimationFrame(this.body.vel, this.body.pos);
    this.flashT = 0;
    this.deadT = 0;
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.mat = makeInkMaterial({ ink, shadeScale: 0, shadeBias: 1 });
    this.solid = makeInkMaterial({ ink: INK.BLACK, fill: true, side: THREE.DoubleSide });
    this.releaseMaterials = services.resources.retain([this.mat, this.solid]);
    this.T = {
      weapon: 'rifle',
      scale: 1.0,
      hat: 'cap',
      build: { bodyW: 1, headS: 1, limbR: 0.033 },
      blockRadius: 0,
    };
    this.hit = HIT;
    this.hitSpheres = HIT.map(() => new THREE.Vector3());
    this.vel = new THREE.Vector3();
    this.interpolation = new RemoteInterpolation(this.body, this.vel);
    this.grappling = false;
    this.gPoint = new THREE.Vector3();
    this._buildModel();
    this.ropeView = new RemoteGrapple(services.scene, services.resources);
    this.rope = this.ropeView.rope;
    this.hook = this.ropeView.hook;
  }
  _buildModel() {
    const model = buildHumanoid(this.mat, this.solid, this.T);
    this.root = model.root;
    this.parts = model.parts;
    this.J = model.J;
    this.face = model.face;
    this.root.visible = false;
    this.services.scene.add(this.root);
    this.weaponIndex = -1;
    // a name tag: a little flag above the head so you know who is who
    this.tagG = new THREE.Group();
    this.root.add(this.tagG);
    this.tagG.position.y = 2.25;
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.28, 0.02),
      makeInkMaterial({ ink: this.ink, fill: true, side: THREE.DoubleSide }),
    );
    this.tagG.add(flag);
    this.animationRig = { root: this.root, joints: this.J, tag: this.tagG, face: this.face };
    this.corpse = false;
    this.services.resources.track(this.root);
  }
  // knocked flat with some physics: the whole figure tumbles away as debris (bits come off on a
  // big hit), and a fresh figure is drawn when the player comes back
  ragdoll(dir, over) {
    if (this.corpse) return;
    this.corpse = true;
    const eff = this.services.effects,
      scene = this.services.scene,
      J = this.J;
    this.tagG.visible = false;
    this.rope.visible = false;
    this.hook.visible = false;
    const d = (
      dir && dir.lengthSq() > 0.01 ? dir.clone() : new THREE.Vector3(0, 0.4, -1)
    ).normalize();
    const detach = (obj, extraVel, radius) => {
      if (!obj || !obj.parent) return;
      obj.updateWorldMatrix(true, false);
      scene.attach(obj);
      _v.copy(d)
        .multiplyScalar(4 + Math.random() * 4)
        .add(extraVel);
      _v.y += 2 + Math.random() * 3;
      eff.debris(
        obj,
        obj.position,
        _v,
        new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
        ),
        { radius, blood: true, life: 7 + Math.random() * 3 },
      );
    };
    if (over) {
      detach(J.headG, _v2.set((Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4), 0.25);
      if (Math.random() < 0.5)
        detach(
          Math.random() < 0.5 ? J.armL : J.armR,
          _v2.set((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6),
          0.12,
        );
    }
    // limp joints, then the body flies as one piece
    for (const k of ['armL', 'armR', 'legL', 'legR', 'foreL', 'foreR', 'shinL', 'shinR'])
      if (J[k]) {
        J[k].rotation.x = (Math.random() - 0.5) * 2.4;
        J[k].rotation.z = (Math.random() - 0.5) * 1.2;
      }
    if (this.face) {
      this.face.eyes.visible = false;
      this.face.xeyes.visible = true;
    }
    this.root.updateWorldMatrix(true, false);
    scene.attach(this.root);
    _v.copy(d).multiplyScalar(5 + Math.random() * 3);
    _v.y += 3.5 + Math.random() * 2;
    _v.addScaledVector(this.vel, 0.4);
    eff.debris(
      this.root,
      this.root.position,
      _v,
      new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 9,
      ),
      { radius: 0.55, blood: true, life: 8 },
    );
    eff.blood(this.center, d, 1.3);
    eff.bloodPool(this.body.pos, 1.2 + Math.random() * 0.6, INK.RED);
    this.root = null;
  }
  get isBlocking() {
    return this.blocking;
  }
  get blockRadius() {
    return 0;
  }
  setWeapon(i) {
    if (i === this.weaponIndex && this.J.gun.children.length) return;
    this.weaponIndex = i;
    const gun = this.J.gun;
    while (gun.children.length) this.services.resources.release(gun.children[0]);
    buildWeaponProp(gun, this.mat, this.solid, { weapon: WEAPON_KINDS[i] || 'rifle' });
    this.services.resources.track(gun);
  }
  get snapA() {
    return this.interpolation.previous;
  }
  get snapB() {
    return this.interpolation.next;
  }
  push(snap, t) {
    if (!snap) return;
    const latest = this.interpolation.push(snap, t);
    this.setWeapon(snap[5]);
    const f = snap[6];
    this.crouching = !!(f & 1);
    this.sliding = !!(f & 2);
    this.blocking = !!(f & 4);
    this.aiming = !!(f & 8);
    this.body.onGround = !!(f & 16);
    this.firing = !!(f & 32);
    const wasAlive = this.alive;
    this.alive = !!(f & 64);
    this.hp = snap[7];
    if (snap.length > 10) this.vel.set(snap[8], snap[9], snap[10]);
    else this.vel.set(0, 0, 0);
    this.grappling = !!(f & 128) && snap.length > 13;
    if (this.grappling) this.gPoint.set(snap[11], snap[12], snap[13]);
    this.parryWindow = !!(f & 256);
    const idle = !!(f & 512);
    if (idle && !this.idle) this.idleSince = t;
    this.idle = idle;
    this.untouched = !!(f & 1024);
    this.away = !!(f & 2048);
    if (wasAlive && !this.alive) this.deadT = 0;
    if (this.alive && this.corpse) {
      this._buildModel();
      this.interpolation.clearPrevious();
      this.body.pos.copy(latest.p);
    }
    if (this.root && !this.root.visible && !this.away) {
      this.body.pos.copy(latest.p);
      this.root.visible = true;
    }
    if (this.root && this.away) this.root.visible = false;
  }
  // damage dealt to this player by the host's bots or by another player's shot goes to its owner
  takeDamage(amount, fromPos) {
    if (this.onDamage) this.onDamage(this, amount, fromPos);
  }
  knockback() {
    /* the owner's client applies its own physics */
  }
  tryBlockMelee(e) {
    if (!this.alive || !this.blocking) return false;
    _v.subVectors(e.center, this.eye).normalize();
    return _v.dot(this.forward) > 0.35;
  }
  tryDeflect() {
    return false;
  }
  flash() {
    this.flashT = 0.08;
    setFill(this.mat, true);
  }
  update(dt, now) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) setFill(this.mat, false);
    }
    const angles = this.interpolation.update(dt, now);
    if (angles) {
      this.yaw = angles.yaw;
      this.pitch = angles.pitch;
    }
    this.speed = this.body.vel.length();
    this.body.height = this.crouching ? 1.05 : 1.75;
    this.eye.set(this.body.pos.x, this.body.pos.y + (this.crouching ? 0.88 : 1.6), this.body.pos.z);
    this.center.set(this.body.pos.x, this.body.pos.y + this.body.height * 0.55, this.body.pos.z);
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (!this.alive) this.deadT += dt;
    if (!this.root) {
      for (const hs of this.hitSpheres) hs.set(0, -100, 0);
      this.rope.visible = false;
      this.hook.visible = false;
      return;
    }
    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.yaw + Math.PI;
    this._animate(dt);
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < HIT.length; i++)
      this.hitSpheres[i].setFromMatrixPosition(this.parts[HIT[i][0]].matrixWorld);
    this._updateRope();
  }
  _updateRope() {
    this.ropeView.update(
      this.grappling && this.alive && !this.away,
      this.body.pos,
      this.right,
      this.gPoint,
    );
  }

  _animate(dt) {
    const frame = this.animationFrame;
    frame.onGround = this.body.onGround;
    frame.alive = this.alive;
    frame.blade = this.weaponIndex === WEAPON_KINDS.length - 1;
    frame.aiming = this.aiming;
    frame.blocking = this.blocking;
    frame.pitch = this.pitch;
    frame.sliding = this.sliding;
    frame.crouching = this.crouching;
    frame.localEye = this.alive ? this.services.localEye() : null;
    this.animation.update(frame, this.animationRig, dt);
  }

  dispose() {
    if (this.root) this.services.resources.release(this.root);
    this.ropeView.dispose();
    this.releaseMaterials();
  }
}
