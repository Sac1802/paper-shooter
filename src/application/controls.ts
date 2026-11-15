import type { SessionAudio, SessionInput } from './session-contracts.js';
interface ControlInput extends SessionInput {
  onLockChange: ((locked: boolean) => void) | null;
  onDeviceChange: ((pad: boolean) => void) | null;
}
interface ControlPorts {
  canvas: HTMLCanvasElement;
  input: ControlInput;
  audio: Pick<SessionAudio, 'init' | 'resume'>;
  hud: {
    onScreenClick: (() => void) | null;
    setDevice(pad: boolean): void;
    setWeapon(name: string, hint: string): void;
  };
  player: { readonly weapon: { name: string; hint: string } };
  applySettings(): void;
  leavePage(): void;
}
interface SessionInputCommands {
  screenClick(): void;
  canvasClick(): void;
  lockChanged(locked: boolean): void;
}
/** Browser event adapter. Session policy is owned by the command receiver. */
export function createControls(ports: ControlPorts, session: SessionInputCommands) {
  const { canvas, input, audio, hud, player, applySettings, leavePage } = ports;
  const listeners: (() => void)[] = [];
  function listen(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ) {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  }
  function dispose() {
    for (const remove of listeners) remove();
    listeners.length = 0;
    input.onLockChange = null;
    input.onDeviceChange = null;
    hud.onScreenClick = null;
  }
  hud.onScreenClick = () => session.screenClick();
  listen(canvas, 'click', () => session.canvasClick());
  input.onLockChange = (locked) => session.lockChanged(locked);
  input.onDeviceChange = (pad) => {
    hud.setDevice(pad);
    hud.setWeapon(player.weapon.name, player.weapon.hint);
  };
  listen(window, 'pagehide', leavePage);
  for (const event of ['pointerdown', 'keydown'])
    listen(
      window,
      event,
      () => {
        audio.init();
        audio.resume();
      },
      { passive: true },
    );
  hud.setDevice(input.usingGamepad);
  applySettings();
  hud.setWeapon(player.weapon.name, player.weapon.hint);
  return { dispose };
}
