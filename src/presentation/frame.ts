import type { Vector3 } from 'three';
import { KATANA_CHARGE_KILLS } from '../domain/focus.js';
import { clamp } from '../engine/math.js';
interface WeaponDisplay {
  readonly kind: string;
  readonly name: string;
  readonly spreadPx: number;
}
type PresentedWeapon = WeaponDisplay &
  (
    | { readonly isGun: false }
    | {
        readonly isGun: true;
        readonly mag: number;
        readonly reserve: number;
        readonly magSize: number;
        readonly reloading: boolean;
      }
  );
export interface FrameDisplayPorts {
  game: {
    readonly time: number;
    readonly queue: readonly unknown[];
    readonly intermission: number;
    readonly katanaStreak: number;
    readonly focus: { readonly active: boolean };
    readonly boss: {
      readonly alive: boolean;
      readonly hp: number;
      readonly maxHp: number;
      readonly T: { readonly name: string };
    } | null;
  };
  player: {
    readonly eye: Vector3;
    readonly right: Vector3;
    readonly weapon: PresentedWeapon;
    readonly weapons: readonly PresentedWeapon[];
    readonly weaponIndex: number;
    readonly hp: number;
    readonly maxHp: number;
    readonly alive: boolean;
    readonly hurtFx: number;
    readonly flashFx: number;
    readonly grenades: number;
    readonly grapStam: number;
  };
  hud: {
    setAmmo(mag: number, reserve: number, size: number, reloading: boolean): void;
    setKatana(): void;
    setSlots(slots: { name: string; active: boolean; ammo: string; empty: boolean }[]): void;
    setGrenades(amount: number): void;
    setGrappleStamina(amount: number): void;
    setHealth(hp: number, maximum: number): void;
    setSpread(amount: number): void;
    update(dt: number): void;
    setFocusMeter(visible: boolean, fraction: number, active: boolean, label: string): void;
    setBoss(name: string | null, fraction: number | null): void;
  };
  audio: { setListener(eye: Vector3, right: Vector3): void; setIntensity(value: number): void };
  renderer: {
    render(
      time: number,
      effects: { hurt: number; flash: number; slow: number; lowHp: number },
    ): void;
  };
  animations(): Iterable<{ update(time: number): void }>;
  online(): boolean;
  enemiesAlive(): number;
  remoteCount(): number;
  clearBoss(): void;
}
/** Projects current gameplay state into HUD/audio/renderer without owning simulation or scheduling. */
export class FramePresentation {
  constructor(private readonly ports: FrameDisplayPorts) {}
  present(playing: boolean, dt: number, scale: number) {
    const { game, player, audio, renderer, animations, enemiesAlive, remoteCount } = this.ports;
    for (const animation of animations()) animation.update(game.time);
    audio.setListener(player.eye, player.right);
    this.updateHud(playing, dt);
    audio.setIntensity(
      clamp((enemiesAlive() + game.queue.length + remoteCount() * 2) / 12, 0, 1) *
        (game.intermission > 0 ? 0.25 : 1),
    );
    renderer.render(game.time, {
      hurt: player.hurtFx,
      flash: player.flashFx,
      slow: scale < 1 ? 1 : 0,
      lowHp: player.alive && player.hp < 30 ? 1 - player.hp / 30 : 0,
    });
  }
  private updateHud(playing: boolean, dt: number) {
    const { game, player, hud, online } = this.ports;
    const weapon = player.weapon;
    if (weapon.isGun) hud.setAmmo(weapon.mag, weapon.reserve, weapon.magSize, weapon.reloading);
    else hud.setKatana();
    hud.setSlots(
      player.weapons.map((item, index) => ({
        name: item.name,
        active: index === player.weaponIndex,
        ammo: item.isGun ? item.mag + '/' + item.reserve : '∞',
        empty: item.isGun && item.mag === 0 && item.reserve === 0,
      })),
    );
    hud.setGrenades(player.grenades);
    hud.setGrappleStamina(player.grapStam);
    hud.setHealth(player.hp, player.maxHp);
    hud.setSpread(weapon.spreadPx);
    hud.update(dt);
    if (online()) hud.setFocusMeter(playing, player.grapStam, false, 'GRAPPLE');
    else
      hud.setFocusMeter(
        playing && (weapon.kind === 'katana' || game.katanaStreak > 0 || game.focus.active),
        game.focus.active ? 1 : clamp(game.katanaStreak / KATANA_CHARGE_KILLS, 0, 1),
        game.focus.active,
        'KATANA',
      );
    const boss = game.boss;
    if (!boss) return;
    if (boss.alive) hud.setBoss(boss.T.name, boss.hp / boss.maxHp);
    else {
      hud.setBoss(null, null);
      this.ports.clearBoss();
    }
  }
}
