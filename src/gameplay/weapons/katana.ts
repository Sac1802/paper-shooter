import type { BladeServices } from './services.js';
import type { WeaponFrame } from '../../domain/weapon-frame.js';
import type { KatanaModel } from '../../presentation/models/weapon-contracts.js';
import { MeleeMechanics } from './melee-mechanics.js';
import { BladeAnimation } from '../../presentation/weapons/blade-animation.js';
import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { ViewModel } from '../../presentation/viewmodel.js';
import { buildKatana } from '../../presentation/models/katana.js';
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
export class Katana extends ViewModel {
  override readonly isGun = false;
  readonly name: string;
  readonly hint: string;
  readonly kind = 'katana';
  private readonly mechanics: MeleeMechanics;
  readonly model: KatanaModel;
  private readonly animation: BladeAnimation;
  constructor(private readonly services: BladeServices) {
    super();
    this.name = 'KATANA';
    this.hint = 'slash · hold aim to block & return bullets';
    this.basePos.set(0.27, -0.25, -0.4);
    this.baseRot.set(0.75, 0.15, -0.35);
    this.aimPos.copy(this.basePos);
    this.mechanics = new MeleeMechanics();
    this.model = buildKatana(this.root);
    this.animation = new BladeAnimation(this.root, this.model, this.recoil, this.recoilRot);
  }

  get spreadPx() {
    return 4;
  }
  startSlash(st: WeaponFrame) {
    this.mechanics.startSlash();
    this.services.audio.katanaSwing();
    this.services.player().kickFov(2);
    if (st.sprinting || !st.grounded) this.services.player().lunge(5.5);
    const P = this.services.player(),
      s = this.mechanics.direction;
    const up = _v2.set(0, 1, 0);
    for (let i = 0; i < 9; i++) {
      const a = (-1.1 + (2.2 * i) / 8) * s;
      const b = a + 0.12 * s;
      const pa = P.eye
        .clone()
        .addScaledVector(P.forward, 1.3)
        .addScaledVector(P.right, Math.cos(a) * 0.9 * s)
        .addScaledVector(up, Math.sin(a) * 0.55 - 0.1);
      const pb = P.eye
        .clone()
        .addScaledVector(P.forward, 1.3)
        .addScaledVector(P.right, Math.cos(b) * 0.9 * s)
        .addScaledVector(up, Math.sin(b) * 0.55 - 0.1);
      this.services.effects.tracer(pa, pb, INK.BLUE, 0.03 - 0.002 * i, 0.12 + i * 0.01);
    }
  }
  get blocking() {
    return this.mechanics.blocking;
  }
  get blockT() {
    return this.mechanics.blockTime;
  }
  get cooldown() {
    return this.mechanics.cooldown;
  }
  set cooldown(value: number) {
    this.mechanics.cooldown = value;
  }
  get damage() {
    return this.mechanics.damage;
  }
  get bloodLevel() {
    return this.animation.bloodLevel;
  }
  update(dt: number, frame: WeaponFrame) {
    this.mechanics.age(dt);
    this.animation.age(dt);
    this.mechanics.guard(dt, frame);
    this.animation.guard(dt, this.mechanics.blocking);
    const swing = this.mechanics.advanceSwing(dt);
    if (swing) {
      this.animation.swing(swing);
      if (swing.hit) this.doHit(frame, swing.direction);
    } else if (this.mechanics.wantsFire(frame)) this.startSlash(frame);
    if (this.mechanics.wantsMelee(frame)) this.startSlash(frame);
  }
  doHit(_frame: WeaponFrame, s: number) {
    const services = this.services,
      P = services.player();
    _v2.copy(P.forward);
    _v.set(-P.forward.z, 0, P.forward.x).multiplyScalar(s * 0.7);
    _v2.add(_v).y -= 0.35;
    _v2.normalize();
    const any = services.impacts.strike(P.eye, P.forward, _v2, s, this.damage);
    // a swing only cuts; bullets are turned aside by the raised guard, never by a slash
    if (any) {
      this.services.audio.katanaHit();
      services.hitstop(0.07, 0.12);
      services.effects.shakeAmt += 0.12;
      services.input.rumble(0.7, 0.4, 90);
      this.recoil.kick(0, 0, 1.5);
    }
  }
  onDeflect(perfect: boolean) {
    this.animation.onDeflect(perfect);
  }
  addBlood(amount: number) {
    this.animation.addBlood(amount);
  }
  updateBlood(dt: number) {
    this.animation.updateBlood(dt);
  }
}
