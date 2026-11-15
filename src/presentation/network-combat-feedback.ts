import { Vector3 } from 'three';
import { INK } from '../shared/ink.js';
export interface ShotActor {
  readonly alive: boolean;
  readonly root: object | null;
  readonly body: { readonly pos: Vector3 };
  readonly right: Vector3;
  readonly forward: Vector3;
  flash(): void;
}
export interface NetworkCombatFeedbackPorts {
  player: { readonly center: Vector3; readonly eye: Vector3; readonly forward: Vector3 };
  opponents: ReadonlyMap<string, ShotActor>;
  effects: {
    strokeBurst(
      point: Vector3,
      ink: number,
      count: number,
      speed: number,
      options: { life: number; size: number },
    ): void;
    tracer(from: Vector3, to: Vector3, ink: number, width: number, life: number): void;
  };
  audio: { shieldHit(point: Vector3): void; remoteShot(kind: string, point: Vector3): void };
  input: { rumble(strong: number, weak: number, duration: number): void };
  hud: { kill(text: string, points: number): void; tip(text: string, duration: number): void };
}
const TRACER_THICK: Readonly<Record<string, number>> = {
  rifle: 0.02,
  shotgun: 0.014,
  sniper: 0.03,
};
/** Projects remote reports into local effects; never applies damage, scores or wire messages. */
export class NetworkCombatFeedback {
  private readonly muzzle = new Vector3();
  private readonly endpoint = new Vector3();
  constructor(private readonly ports: NetworkCombatFeedbackPorts) {}
  parry(returned: boolean) {
    const { player, audio, input, effects, hud } = this.ports;
    audio.shieldHit(player.center);
    input.rumble(0.35, 0.3, 60);
    effects.strokeBurst(player.eye.clone().addScaledVector(player.forward, 0.5), INK.ORANGE, 8, 5, {
      life: 0.2,
      size: 0.03,
    });
    hud.kill(returned ? 'RETURN TO SENDER' : 'DEFLECTED', returned ? 25 : 0);
  }
  cut() {
    const { player, effects, hud, input } = this.ports;
    effects.strokeBurst(player.center, INK.ORANGE, 8, 4, { life: 0.25, size: 0.03 });
    hud.tip('your rope got cut', 1.3);
    input.rumble(0.5, 0.3, 80);
  }
  shots(kind: string, endpoints: readonly number[], sender: string) {
    const { opponents, effects, audio } = this.ports;
    const actor = opponents.get(sender);
    if (!actor || !actor.root || !actor.alive) return;
    const muzzle = this.muzzle;
    muzzle.set(
      actor.body.pos.x + actor.right.x * 0.3 + actor.forward.x * 0.8,
      actor.body.pos.y + 1.35 + actor.forward.y * 0.8,
      actor.body.pos.z + actor.right.z * 0.3 + actor.forward.z * 0.8,
    );
    const thickness = TRACER_THICK[kind] || 0.02;
    for (let i = 0; i + 2 < endpoints.length; i += 3) {
      this.endpoint.set(endpoints[i], endpoints[i + 1], endpoints[i + 2]);
      effects.tracer(muzzle, this.endpoint, INK.BLUE, thickness, 0.06);
    }
    actor.flash();
    audio.remoteShot(kind, muzzle);
  }
}
