export const KB_KEYS: Readonly<Record<string, string>> = {
  fire: 'LMB',
  aim: 'RMB',
  block: 'RMB',
  jump: 'Space',
  sprint: 'Shift',
  slide: 'C',
  dash: 'C',
  grapple: 'Q',
  melee: 'F',
  reload: 'R',
  grenade: 'G',
  focus: 'both mouse buttons (or X)',
  next: 'wheel',
  pause: 'Esc',
  confirm: 'Space',
  score: 'Tab',
};
export const PAD_KEYS: Readonly<Record<string, string>> = {
  fire: 'R2',
  aim: 'L2',
  block: 'L2',
  jump: '✕',
  sprint: 'L3',
  slide: '○',
  dash: '○',
  grapple: 'L1',
  melee: 'R1',
  reload: '□',
  grenade: 'R3',
  focus: 'L2 + R2',
  next: '△',
  pause: 'Options',
  confirm: '✕',
  score: 'Create',
};
export const CONTROLS_HTML = `
<div class="cols">
  <div><div class="colhead">MOUSE + KEYBOARD</div>
    <div><b>WASD</b> move &nbsp; <b>Mouse</b> look &nbsp; <b>Shift</b> sprint</div>
    <div><b>LMB</b> fire / slash &nbsp; <b>RMB</b> aim down sights / block</div>
    <div><b>Space</b> jump (again on a wall = wall jump)</div>
    <div><b>Space</b> again in the air = double jump</div>
    <div><b>C / Ctrl</b> slide on the ground · air dash in the air</div>
    <div><b>Q / E</b> grapple: tap to swing, hold to reel, jump to launch</div>
    <div><b>F</b> quick katana slash &nbsp; <b>R</b> reload &nbsp; <b>M</b> music</div>
    <div><b>G</b> grenade · hold it to throw further</div>
    <div><b>Tab</b> scoreboard (online) &nbsp; <b>Esc</b> pause</div>
    <div><b>Both mouse buttons</b> dash-slash once the gauge is lit</div>
    <div><b>1-4 / wheel</b> rifle · shotgun · sniper · katana</div>
  </div>
  <div><div class="colhead">PS5 CONTROLLER</div>
    <div><b>L stick</b> move &nbsp; <b>R stick</b> look &nbsp; <b>L3</b> sprint</div>
    <div><b>R2</b> fire / slash &nbsp; <b>L2</b> aim / block</div>
    <div><b>✕</b> jump &nbsp; <b>○</b> slide · air dash</div>
    <div><b>L1</b> grapple (hold to reel, ✕ to launch)</div>
    <div><b>L2 + R2</b> dash-slash once the katana gauge is lit</div>
    <div><b>R1</b> quick katana slash, then back to your gun</div>
    <div><b>□</b> reload &nbsp; <b>△</b> next weapon</div>
    <div><b>R3 / d-pad up</b> grenade · hold to throw further</div>
    <div><b>Create</b> scoreboard (online) &nbsp; <b>Options</b> pause</div>
  </div>
</div>`;
