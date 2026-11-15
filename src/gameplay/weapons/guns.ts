import { GunMechanics } from './gun-mechanics.js';
import { GunAnimation } from '../../presentation/weapons/gun-animation.js';
import { ShellEjection } from '../../presentation/weapons/shell-ejection.js';
import * as THREE from 'three';
import { makeInkMaterial } from '../../presentation/ink/materials.js';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
import { ViewModel } from '../../presentation/viewmodel.js';
import type { GunServices } from './services.js';
import type { GunKind, GunDefinition } from '../../domain/weapons.js';
import type { WeaponFrame } from '../../domain/weapon-frame.js';
import type { GunModel, GunMaterials } from '../../presentation/models/weapon-contracts.js';
import { GUNS } from '../../domain/weapons.js';
import {
  buildRifle,
  buildShotgun,
  buildSniper,
  buildRevolver,
} from '../../presentation/models/guns.js';
const gunBuilders = {
  rifle: buildRifle,
  shotgun: buildShotgun,
  sniper: buildSniper,
  revolver: buildRevolver,
};
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
export class Gun extends ViewModel {
  override readonly isGun = true;
  private readonly definition: GunDefinition;
  private readonly mechanics: GunMechanics;
  readonly model: GunModel;
  readonly mat: GunMaterials['mat'];
  readonly dark: GunMaterials['dark'];
  readonly red: GunMaterials['red'];
  private readonly ejection: ShellEjection;
  private readonly animation: GunAnimation;
  private readonly readMuzzle: (out: THREE.Vector3) => void;
  private autoReloadTimer: ReturnType<typeof setTimeout> | null;
  private disposed: boolean;
  constructor(
    private readonly services: GunServices,
    type: GunKind,
  ) {
    super();
    this.definition = GUNS[type];
    this.adsFov = this.definition.adsFov;
    this.scope = this.definition.scope;
    this.mechanics = new GunMechanics(this.definition);
    this.autoReloadTimer = null;
    this.disposed = false;
    this.mat = makeInkMaterial({ ink: INK.BLUE });
    this.dark = makeInkMaterial({ ink: INK.BLACK });
    this.red = makeInkMaterial({ ink: INK.RED, fill: true });
    this.model = gunBuilders[type](this.root, { mat: this.mat, dark: this.dark, red: this.red });
    this.readMuzzle = (out) => this.model.muzzle.getWorldPosition(out);
    this.ejection = new ShellEjection(
      this.model.ejectPt,
      this.definition.shell,
      services.player,
      (point, velocity, ink, size) => services.effects.shell(point, velocity, ink, size),
    );
    this.animation = new GunAnimation(this.root, this.model, this.recoil, this.recoilRot, {
      pump: () => services.audio.pump(),
      shell: () => services.audio.shell(),
      eject: (spread) => this.ejection.eject(spread),
    });
    this.setSight(...this.definition.sight);
  }
  get name() {
    return this.definition.name;
  }
  get hint() {
    return this.definition.hint;
  }
  get kind() {
    return this.definition.kind;
  }
  get magSize() {
    return this.definition.magSize;
  }
  get maxReserve() {
    return this.definition.maxReserve;
  }
  get damage() {
    return this.definition.damage;
  }
  get mag() {
    return this.mechanics.mag;
  }
  set mag(value: number) {
    this.mechanics.mag = value;
  }
  get reserve() {
    return this.mechanics.reserve;
  }
  set reserve(value: number) {
    this.mechanics.reserve = value;
  }
  get reloading() {
    return this.mechanics.reloading;
  }
  get spreadPx() {
    return 5 + this.mechanics.spread * 900;
  }
  addAmmo(amount: number) {
    this.mechanics.addAmmo(amount);
  }
  addAmmoFraction(fraction: number) {
    this.addAmmo(Math.round(this.maxReserve * fraction));
  }
  resetAmmo() {
    this.mechanics.resetAmmo();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.autoReloadTimer !== null) clearTimeout(this.autoReloadTimer);
    this.autoReloadTimer = null;
  }
  startReload() {
    if (this.disposed) return;
    if (!this.mechanics.startReload()) return;
    this.animation.beginReload();
    if (this.definition.reloadType === 'shells') this.services.audio.shell();
    else if (this.definition.reloadType === 'cylinder') this.services.audio.cylinder();
    else this.services.audio.reload();
  }
  update(dt: number, frame: WeaponFrame) {
    if (this.disposed) return;
    const state = this.mechanics;
    state.ageFire(dt);
    this.animation.ageFlash(dt);
    state.bloom(dt, frame);
    const pump = state.advancePump(dt);
    if (pump) this.animation.pump(pump);
    if (state.reloading && this._advanceReload(dt)) return;
    if (state.wantsReload(frame)) {
      this.startReload();
      return;
    }
    const trigger = state.trigger(frame);
    if (trigger === 'empty') {
      if (frame.firePressed) {
        this.services.audio.empty();
        this.startReload();
      }
    } else if (trigger === 'fire') {
      if (state.interruptReload()) this.animation.restoreHand();
      this.fire(frame);
    }
  }
  _advanceReload(dt: number) {
    const progress = this.mechanics.advanceReload(dt);
    if (this.definition.reloadType === 'mag') {
      this.animation.magazine(progress);
      this.mechanics.finishMagazine();
      return true;
    }
    if (this.definition.reloadType === 'cylinder') {
      this.animation.cylinder(progress);
      if (this.mechanics.finishMagazine()) this.animation.closeCylinder();
      return true;
    }
    this.animation.shell(progress);
    const result = this.mechanics.finishShell();
    if (result === 'complete') this.animation.restoreHand();
    else if (result === 'loaded') this.services.audio.shell();
    return false;
  }
  fire(st: WeaponFrame) {
    if (this.disposed) return;
    const services = this.services,
      P = services.player();
    const spreadNow = this.mechanics.beginShot();
    let hits = 0;
    for (let i = 0; i < this.definition.pellets; i++)
      if (this.fireRay(P.eye, P.aimDir(spreadNow))) hits++;
    // fx
    this.animation.showFlash(this.definition.flashScale);
    this.model.muzzle.getWorldPosition(_v);
    _v2.copy(P.forward);
    services.effects.strokeBurst(
      _v,
      INK.ORANGE,
      4 + this.definition.pellets,
      6 * this.definition.flashScale,
      {
        life: 0.08,
        size: 0.03,
        gravity: 0,
        drag: 8,
      },
    );
    services.effects.smoke(_v, _v2, this.kind === 'shotgun' ? 5 : 2);
    if (this.definition.shell && this.definition.reloadType !== 'shells') this.ejection.eject();
    if (this.mechanics.armCycle()) this.animation.resetPump();
    const k = this.definition.modelKick;
    this.recoil.kick(rand(-k[0], k[0]), rand(k[1] * 0.4, k[1]), k[2]);
    this.recoilRot.kick(k[3], rand(-k[4], k[4]), rand(-k[5], k[5]));
    P.recoil(
      this.definition.camKick[0] * (st.aim ? 0.7 : 1) + rand(0, this.definition.camKick[0] * 0.3),
      rand(-this.definition.camKick[1], this.definition.camKick[1]),
    );
    P.kickFov(this.definition.fovKick);
    this.services.audio[this.definition.sound]();
    services.input.rumble(
      0.15 + this.definition.fovKick * 0.08,
      0.5,
      40 + this.definition.fovKick * 15,
    );
    services.effects.shakeAmt += 0.02 + this.definition.fovKick * 0.02;
    if (hits > 0 && this.kind === 'shotgun') services.hitstop(0.03, 0.3);
    if (this.mag === 0 && this.definition.reloadType === 'mag') {
      if (this.autoReloadTimer !== null) clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = setTimeout(() => {
        this.autoReloadTimer = null;
        if (!this.disposed && this.mag === 0 && !this.reloading) this.startReload();
      }, 250);
    }
  }
  fireRay(origin: THREE.Vector3, dir: THREE.Vector3) {
    return this.services.impacts.fire(this.definition, origin, dir, this.readMuzzle);
  }
}
export class Rifle extends Gun {
  constructor(services: GunServices) {
    super(services, 'rifle');
  }
}
export class Shotgun extends Gun {
  constructor(services: GunServices) {
    super(services, 'shotgun');
    this.basePos.set(0.2, -0.19, -0.34);
  }
}
export class Revolver extends Gun {
  constructor(services: GunServices) {
    super(services, 'revolver');
    this.basePos.set(0.19, -0.2, -0.3);
  }
}
export class Sniper extends Gun {
  constructor(services: GunServices) {
    super(services, 'sniper');
    this.basePos.set(0.21, -0.19, -0.36);
  }
}
