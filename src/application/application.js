import { SessionController } from './session-controller.js';
import { RunReset } from './run-reset.js';
import { createRuntime } from './runtime.js';
import { createPickups } from './pickups.js';
import { createFocus } from './focus.js';
import { createWaves } from './waves.js';
import { createMatch } from './match.js';
import { createScreens } from './screens.js';
import { createMultiplayer } from './multiplayer.js';
import { createControls } from './controls.js';
import { createLoop } from './loop.js';

// Callbacks connect controllers explicitly; factories register callbacks but do not start the loop.
/** @param {import('./contracts.js').ApplicationOptions} options */
export function createApplication(options) {
  const runtime = createRuntime(options, {
    spawnPickup: (...args) => pickups.spawnPickup(...args),
  });
  const audio = runtime.audio;
  const debug = {
    ...runtime,
    get level() {
      return runtime.state.level;
    },
    get nav() {
      return runtime.state.nav;
    },
    inspect() {
      return {
        state: runtime.game.state,
        mode: runtime.game.mode,
        map: runtime.state.level.key,
        wave: runtime.game.wave,
        hp: runtime.player.hp,
        alive: runtime.enemies.alive,
        weapon: runtime.player.weapon.kind,
      };
    },
  };
  window.__game = debug;
  const pickups = createPickups(runtime, {});
  const combat = runtime.combat;
  const focus = createFocus(runtime, {});
  const waves = createWaves(runtime, {
    spawnPickup: (...args) => pickups.spawnPickup(...args),
    enterFocus: (...args) => focus.enterFocus(...args),
  });
  const match = createMatch(runtime, {
    endFocus: (...args) => focus.endFocus(...args),
  });
  const reset = new RunReset({
    state: runtime.state,
    game: runtime.game,
    player: runtime.player,
    resources: runtime.resources,
    enemies: runtime.enemies,
    effects: runtime.effects,
    hud: runtime.hud,
    online: runtime.online,
    setLevel: runtime.setLevel,
    endFocus: () => focus.endFocus(),
  });
  const session = new SessionController({
    game: runtime.game,
    screen: runtime.state,
    input: runtime.input,
    audio,
    hud: runtime.hud,
    presentation: {
      start: () => screens.showStart(),
      pause: () => screens.showPause(),
      clickToPlay: () => screens.showClickToPlay(),
    },
    transport: runtime.net,
    lobby: runtime.lobby,
    scores: runtime.scores,
    player: runtime.player,
    remote: () => runtime.remote.values(),
    setArena: runtime.setArena,
    resetRun: () => reset.reset(),
    clearWave: () => reset.clearWave(),
    startWave: (wave) => waves.startWave(wave),
    spawnSpots: () => match.spawnSpots(),
    arenaSpawn: () => match.arenaSpawn(),
    sendScores: () => match.sendScores(),
    refreshScores: () => match.refreshScoreHud(),
  });
  const screens = createScreens(runtime, {
    cancelPending: () => multiplayer.cancelPending(),
    lobbyRows: (...args) => multiplayer.lobbyRows(...args),
    friendlyError: (...args) => multiplayer.friendlyError(...args),
    quickPlay: (...args) => multiplayer.quickPlay(...args),
    createLobby: (...args) => multiplayer.createLobby(...args),
    setStatus: (...args) => multiplayer.setStatus(...args),
    joinLobby: (...args) => multiplayer.joinLobby(...args),
    broadcastLobby: (...args) => multiplayer.broadcastLobby(...args),
    hostStart: (...args) => session.hostStart(...args),
    leaveOnline: (...args) => multiplayer.leaveOnline(...args),
    beginAtWave: (...args) => session.beginAtWave(...args),
    begin: (...args) => session.begin(...args),
    sortedScores: (...args) => match.sortedScores(...args),
    toMainMenu: () => session.toMainMenu(),
  });
  const multiplayer = createMultiplayer(runtime, {
    renderLobby: (...args) => screens.renderLobby(...args),
    sendScores: (...args) => match.sendScores(...args),
    refreshScoreHud: (...args) => match.refreshScoreHud(...args),
    farthestSpawnIndex: (...args) => match.farthestSpawnIndex(...args),
    startMatch: (...args) => session.startMatch(...args),
    breakProp: (...args) => combat.breakProp(...args),
    hostStart: (...args) => session.hostStart(...args),
    endMatch: (...args) => match.endMatch(...args),
    toLobbyScreen: (...args) => session.toLobbyScreen(...args),
    spawnPickup: (...args) => pickups.spawnPickup(...args),
    removePickup: (...args) => pickups.removePickup(...args),
    tallyDeath: (...args) => match.tallyDeath(...args),
    applyScores: (...args) => match.applyScores(...args),
    sortedScores: (...args) => match.sortedScores(...args),
    session: {
      enterLobby: () => session.enterLobby(),
      returnOnline: () => session.returnOnline(),
      takeClockAuthority: () => session.takeClockAuthority(),
      recoverHost: (wasInMatch) => session.recoverHost(wasInMatch),
      recoverFollower: (wasInMatch) => session.recoverFollower(wasInMatch),
    },
    connectionPresentation: {
      start: () => screens.showStart(),
      status: (message) => screens.showConnectionStatus(message),
      unlockButtons: () => screens.unlockButtons(),
      message: (...args) => runtime.hud.message(...args),
      feed: (message) => runtime.hud.kill(message, 0),
    },
  });
  const controls = createControls(
    {
      canvas: runtime.canvas,
      input: runtime.input,
      hud: runtime.hud,
      audio,
      player: runtime.player,
      applySettings: runtime.applySettings,
      leavePage: () => {
        if (runtime.net.active) multiplayer.cancelPending();
      },
    },
    session,
  );
  // Keep the existing development/browser automation API in the composition root.
  Object.assign(debug, {
    startWave: (wave) => waves.startWave(wave),
    updateWaves: (dt) => waves.updateWaves(dt),
    begin: () => session.begin(),
    beginAtWave: (wave) => session.beginAtWave(wave),
    jumpToWave: (wave) => session.jumpToWave(wave),
    resetGame: () => session.resetGame(),
    spawnPickup: (...args) => pickups.spawnPickup(...args),
    focusCandidate: () => focus.focusCandidate(),
    enterFocus: (...args) => focus.enterFocus(...args),
    pickSpawn: (...args) => waves.pickSpawn(...args),
    startMatch: (...args) => session.startMatch(...args),
    createLobby: (...args) => multiplayer.createLobby(...args),
    joinLobby: (...args) => multiplayer.joinLobby(...args),
    quickPlay: () => multiplayer.quickPlay(),
    leaveOnline: (...args) => multiplayer.leaveOnline(...args),
    hostStart: () => session.hostStart(),
  });
  const loop = createLoop(runtime, {
    resume: (...args) => session.resume(...args),
    pause: (...args) => session.pause(...args),
    boardHTML: (...args) => match.boardHTML(...args),
    updateFocus: (...args) => focus.updateFocus(...args),
    endFocus: (...args) => focus.endFocus(...args),
    updatePickups: (...args) => pickups.updatePickups(...args),
    netUpdate: (...args) => multiplayer.netUpdate(...args),
    updateWaves: (...args) => waves.updateWaves(...args),
    updateArenaPickups: (...args) => pickups.updateArenaPickups(...args),
    respawnLocal: (...args) => match.respawnLocal(...args),
    showDead: (...args) => screens.showDead(...args),
    toLobbyScreen: (...args) => session.toLobbyScreen(...args),
  });

  runtime.game.onPlayerDeath = () => {
    focus.endFocus();
    match.onLocalDeath();
  };
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    loop.stop();
    controls.dispose();
    session.dispose();
    multiplayer.dispose();
    runtime.input.dispose?.();
    runtime.player.dispose();
    pickups.dispose();
    runtime.enemies.clear();
    runtime.effects.dispose();
    for (const remote of runtime.remote.values()) remote.dispose();
    runtime.remote.clear();
    audio.dispose();
    runtime.resources.track(runtime.R.scene);
    runtime.resources.dispose();
    runtime.R.scene.clear();
    runtime.R.dispose?.();
    if (window.__game === debug) delete window.__game;
  }
  screens.showStart();
  if (options.autoStart !== false) loop.start();
  return {
    runtime,
    pickups,
    combat,
    focus,
    waves,
    match,
    screens,
    multiplayer,
    controls,
    session,
    loop,
    dispose,
  };
}
