import type { SavedPreferences, PreferencePort } from '../platform/preferences.js';

export type UserSettingsState = Pick<SavedPreferences, 'settings' | 'musicWanted' | 'myName'>;
export interface UserSettingsPorts {
  state: UserSettingsState;
  preferences: Pick<PreferencePort, 'write'>;
  input: { mouseSens: number; padSensX: number; padSensY: number; invertY: boolean };
  audio: { musicOn(playing: boolean): void };
  player: { name: string };
  transport: { hostName: string };
}
/** Owns persisted user edits and adapter synchronization; no screen or DOM access. */
export class UserSettings {
  constructor(private readonly ports: UserSettingsPorts) {}
  applyLook() {
    const { state, input, preferences } = this.ports;
    const settings = state.settings;
    input.mouseSens = (0.0022 * settings.sens) / 100;
    input.padSensX = (3.4 * settings.sens) / 100;
    input.padSensY = (2.6 * settings.sens) / 100;
    input.invertY = settings.invert;
    preferences.write('sens', settings.sens);
    preferences.write('invert', settings.invert ? '1' : '0');
  }
  setSensitivity(value: number) {
    this.ports.state.settings.sens = value;
    this.applyLook();
  }
  setInvert(value: boolean) {
    this.ports.state.settings.invert = value;
    this.applyLook();
  }
  setMusic(value: boolean) {
    const { state, preferences, audio } = this.ports;
    state.musicWanted = value;
    preferences.write('music', state.musicWanted ? '1' : '0');
    audio.musicOn(state.musicWanted);
  }
  toggleMusic() {
    this.setMusic(!this.ports.state.musicWanted);
    return this.ports.state.musicWanted;
  }
  setName(value: string) {
    const { state, preferences, player, transport } = this.ports;
    state.myName = value.trim().slice(0, 14) || state.myName;
    preferences.write('name', state.myName);
    player.name = state.myName;
    transport.hostName = state.myName;
  }
}
