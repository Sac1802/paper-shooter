import { FOCUS_SCALE } from '../domain/focus.js';
import { FrameInteraction } from './frame-interaction.js';
import { FramePresentation } from '../presentation/frame.js';

export function createLoop(runtime, actions = {}) {
  const audio = runtime.audio;
  const { net, input, game, hud, online, userSettings, player, enemies, effects, remote, R } =
    runtime;
  const {
    resume,
    pause,
    boardHTML,
    updateFocus,
    endFocus,
    updatePickups,
    netUpdate,
    updateWaves,
    updateArenaPickups,
    updateDeath,
    toLobbyScreen,
  } = actions;
  // ---------------- loop ----------------
  let last = performance.now(),
    musicHealT = 2;
  const interaction = new FrameInteraction({
    input,
    hud,
    online,
    menuOpen: () => game.menu,
    screenClick: () => hud.onScreenClick(),
    resume,
    pause,
    toggleMusic: () => userSettings.toggleMusic(),
    boardVisible: () => !hud.el.board.hidden,
    boardHTML,
  });
  const presentation = new FramePresentation({
    game,
    player,
    hud,
    audio,
    renderer: R,
    animations: () => runtime.state.level.animated,
    online,
    enemiesAlive: () => enemies.alive,
    remoteCount: () => remote.size,
    clearBoss: () => {
      game.boss = null;
    },
  });
  function tick(now) {
    if (!running) return;
    frameId = requestAnimationFrame(tick);
    step(now);
  }
  // browsers starve animation frames in hidden tabs; a host that alt-tabs would freeze everyone's
  // match, so a coarse timer runs extra steps (never extra frame chains) while that happens
  function timeScale(dt) {
    if (game.hitstopT > 0) {
      game.hitstopT -= dt;
      return game.hitstopScale;
    }
    return game.focus.active ? FOCUS_SCALE : 1;
  }

  function recoverMusic(st, dt) {
    musicHealT -= dt;
    if (musicHealT > 0) return;
    musicHealT = 2;
    if (runtime.state.musicWanted && st === 'play' && !audio.musicPlaying && audio.ctx)
      audio.musicOn(true);
    if (input.anyInput) audio.resume();
  }

  function enforceBounds() {
    const bounds = runtime.state.level.bounds;
    const pos = player.body.pos;
    if (
      pos.x < bounds.minX - 8 ||
      pos.x > bounds.maxX + 8 ||
      pos.z < bounds.minZ - 8 ||
      pos.z > bounds.maxZ + 8 ||
      pos.y > 150
    )
      pos.y = -100;
  }

  function updateCombo(dt) {
    if (game.comboT <= 0) return;
    game.comboT -= dt;
    if (game.comboT <= 0) {
      game.combo = 0;
      hud.setScore(game.score, 0);
    }
  }

  function updateSimulation(st, dt, sdt) {
    game.time += sdt;
    if (player.shieldT > 0) player.shieldT -= dt;
    recoverMusic(st, dt);
    enforceBounds();
    player.update(sdt);
    enemies.update(sdt);
    effects.update(sdt);
    updatePickups(sdt);
    netUpdate(dt);
    if (st === 'play' && !online()) updateWaves(sdt);
    if (online()) updateArenaPickups(dt);
    updateCombo(sdt);
    updateDeath(st, dt);
  }

  function updateIdle(st, dt) {
    game.time += dt;
    if (['start', 'dead', 'lobby', 'over'].includes(st)) player.idleCam(game.time);
    effects.update(dt);
    if (net.active) netUpdate(dt);
    if (st !== 'over') return;
    game.overT += dt;
    if (net.isHost && game.overT > 8) {
      net.send('backtolobby', {});
      toLobbyScreen();
    } else if (!net.isHost && game.overT > 15) toLobbyScreen();
  }

  function step(now) {
    // Preserve the original variable step and its 50 ms cap; changing integration would change feel.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    input.update(dt);
    const st = game.state;
    const playing = st === 'play' || st === 'dying';
    interaction.update(st, playing, dt);
    const scale = timeScale(dt);
    if (st === 'play' && !online()) updateFocus(dt);
    else endFocus();
    if (playing) updateSimulation(st, dt, dt * scale);
    else updateIdle(st, dt);
    presentation.present(playing, dt, scale);
  }

  let running = false,
    frameId = 0,
    backgroundTimer = null;
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    frameId = requestAnimationFrame(tick);
    backgroundTimer = setInterval(() => {
      if (net.active && performance.now() - last > 300) step(performance.now());
    }, 250);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
    clearInterval(backgroundTimer);
  }

  return { tick, step, start, stop };
}
