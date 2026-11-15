interface SettingsView {
  readonly settings: { readonly sens: number; readonly invert: boolean };
  readonly musicWanted: boolean;
}
interface SettingsCommands {
  setSensitivity(value: number): void;
  setInvert(value: boolean): void;
  setMusic(value: boolean): void;
  setName(value: string): void;
}
/** DOM event translation and markup only; the command receiver owns persistence and adapter state. */
export class SettingsPanel {
  constructor(
    private readonly view: SettingsView,
    private readonly commands: SettingsCommands,
  ) {}
  html() {
    return `<div class="settings" id="settings">
    <label>look sensitivity <input type="range" id="setSens" min="25" max="250" step="5" value="${this.view.settings.sens}"><b id="setSensV">${this.view.settings.sens}%</b></label>
    <label><input type="checkbox" id="setInv" ${this.view.settings.invert ? 'checked' : ''}> invert vertical look</label>
    <label><input type="checkbox" id="setMus" ${this.view.musicWanted ? 'checked' : ''}> music <span class="k">(M)</span></label>
  </div>`;
  }
  wire(panel: ParentNode) {
    const box = panel.querySelector('#settings');
    if (!box) return;
    box.addEventListener('click', (event) => event.stopPropagation());
    box.addEventListener('keydown', (event) => event.stopPropagation());
    const sensitivity = box.querySelector<HTMLInputElement>('#setSens');
    const output = box.querySelector('#setSensV');
    if (sensitivity && output)
      sensitivity.addEventListener('input', () => {
        const value = Number(sensitivity.value);
        output.textContent = value + '%';
        this.commands.setSensitivity(value);
      });
    const invert = box.querySelector<HTMLInputElement>('#setInv');
    invert?.addEventListener('change', () => this.commands.setInvert(invert.checked));
    const music = box.querySelector<HTMLInputElement>('#setMus');
    music?.addEventListener('change', () => this.commands.setMusic(music.checked));
  }
  wireName(panel: ParentNode) {
    const name = panel.querySelector<HTMLInputElement>('#setName');
    name?.addEventListener('input', () => this.commands.setName(name.value));
  }
}
