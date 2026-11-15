import { InkRenderer } from '../presentation/renderer.js';
import { World } from '../engine/physics.js';
import { Input } from '../platform/input.js';
import { buildLevel } from '../maps/index.js';
import { NavGrid } from '../engine/navigation.js';
import { Effects } from '../presentation/effects.js';
import { Hitscan } from '../gameplay/weapons/hitscan.js';
import { MeleeImpacts } from '../gameplay/weapons/melee-impacts.js';
import { EnemyManager } from '../gameplay/enemies.js';
import { Player } from '../gameplay/player.js';
import { Net } from '../network/peer-transport.js';
import { HUD } from '../presentation/hud.js';
import { Sfx } from '../presentation/audio.js';
import { browserPreferences } from '../platform/preferences.js';
import { comboScore, FFA_TIME } from '../domain/match.js';
import { knownMap } from '../domain/maps.js';
import { SceneResources } from '../engine/resources.js';

/** Owns resources and shared match state; controllers receive explicit actions from composition. */
/** @param {import('./contracts.js').ApplicationOptions} options */
export function createRuntime(options) {
  const audio = options.audio ?? new Sfx();
  const resources = new SceneResources();
  const canvas = options.canvas;
  const R = options.renderer ?? new InkRenderer(canvas);
  const world = new World();
  const preferences = options.preferences ?? browserPreferences();
  const saved = preferences.load();
  const state = {
    ...saved,
    loadedKey: saved.mapKey,
    arenaLoaded: false,
    matchLeft: FFA_TIME,
    clockT: 0,
    clockRunning: false,
    screen: 'main',
    pickups: [],
    pickupClock: 0,
  };
  state.level = buildLevel(R.scene, world, state.mapKey, { arena: false });
  state.nav = new NavGrid(world, state.level.bounds, 1).build();
  const input = options.input ?? new Input(canvas);
  const hud = options.hud ?? new HUD(options.hudRoot);
  const effects = new Effects(R.scene, world, resources);
  const ctx = {
    resources,
    scene: R.scene,
    camera: R.camera,
    world,
    level: state.level,
    nav: state.nav,
    input,
    hud,
    effects,
    audio,
    renderer: R,
  };
  const game = (ctx.game = {
    state: 'start',
    mode: 'solo',
    menu: false,
    time: 0,
    hitstopT: 0,
    hitstopScale: 1,
    wave: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    kills: 0,
    intermission: 0,
    queue: [],
    spawnT: 0,
    maxAlive: 6,
    deathT: 0,
    katanaStreak: 0,
    boss: null,
    respawnT: 0,
    matchT: 0,
    over: null,
    overT: 0,
    clockStarted: false,
    respawnArm: 0,
    promptT: 0,
    focus: { active: false, t: 0, chain: 0, target: null, dash: null, arm: 0, ready: false },
    hitstop(duration, scale) {
      this.hitstopT = Math.max(this.hitstopT, duration);
      this.hitstopScale = scale;
    },
    addScore(points, label) {
      const awarded = comboScore(points, this.combo);
      this.score += awarded;
      if (label) hud.kill(label, awarded);
      hud.setScore(this.score, this.combo);
    },
    onPlayerDeath() {},
  });
  const enemies = (ctx.enemies = new EnemyManager({
    scene: R.scene,
    resources,
    world,
    navigation: () => ctx.nav,
    player: () => ctx.player,
    targets: () => (ctx.targets ? ctx.targets() : [ctx.player]),
    effects,
    audio,
    hud,
    input,
    hitstop: (duration, scale) => game.hitstop(duration, scale),
    score: (points, label) => game.addScore(points, label),
  }));
  const enemyWeaponQueries = {
    raycast: (...args) => enemies.raycast(...args),
    inArc: (...args) => enemies.inArc(...args),
    damage: (...args) => enemies.damage(...args),
  };
  const playerWeaponQueries = {
    raycast: (...args) => ctx.raycastPlayers?.(...args) ?? null,
    inArc: (...args) => ctx.playersInArc?.(...args) ?? [],
    damage: (...args) => ctx.hitPlayer(...args),
  };
  ctx.hitscan = new Hitscan({
    world,
    enemies: enemyWeaponQueries,
    players: playerWeaponQueries,
    breakableHit: (...args) => {
      if (!ctx.breakHit) return false;
      ctx.breakHit(...args);
      return true;
    },
    feedback: {
      tracer: (...args) => effects.tracer(...args),
      bulletImpact: (...args) => effects.bulletImpact(...args),
      ricochet: (...args) => audio.ricochet(...args),
      shot: (point) => ctx.onShot?.(point),
    },
  });
  ctx.meleeImpacts = new MeleeImpacts({
    enemies: enemyWeaponQueries,
    players: playerWeaponQueries,
    ropes: { cut: (...args) => ctx.cutRopes?.(...args) ?? false },
    props: {
      inArc: (...args) => ctx.breakablesInArc?.(...args) ?? [],
      damage: (...args) => ctx.breakHit(...args),
    },
  });
  ctx.gunServices = {
    player: () => ctx.player,
    impacts: ctx.hitscan,
    effects,
    audio,
    input,
    hitstop: (duration, scale) => game.hitstop(duration, scale),
  };
  ctx.bladeServices = {
    player: () => ctx.player,
    impacts: ctx.meleeImpacts,
    effects,
    audio,
    input,
    hitstop: (duration, scale) => game.hitstop(duration, scale),
  };
  const player = (ctx.player = new Player({
    environment: {
      scene: R.scene,
      camera: R.camera,
      resources,
      world,
      spawnPoint: () => ctx.level.playerStart,
    },
    input,
    feedback: {
      audio,
      input,
      hud,
      effects,
      score: (points, label) => game.addScore(points, label),
      hitstop: (duration, scale) => game.hitstop(duration, scale),
    },
    weapons: { gun: ctx.gunServices, blade: ctx.bladeServices },
    grappleQueries: {
      raycastEnemy: (...args) => enemies.raycast(...args),
      enemies: () => enemies.enemies,
      landmarks: () => ctx.level,
      yank: (...args) => enemies.yank(...args),
    },
    died: () => game.onPlayerDeath(),
  }));
  player.name = state.myName;
  const net = options.net ?? new Net();
  const remote = new Map();
  const lobby = {
    players: new Map(),
    hostId: null,
    isPublic: true,
    status: '',
    code: '',
    map: null,
  };
  const scores = new Map();
  const online = () => game.mode === 'ffa';
  const inMatch = () => ['play', 'dying', 'over'].includes(game.state);
  const shotQueue = [];

  function setLevel(key, arena, force = false) {
    if (!force && key === state.loadedKey && arena === state.arenaLoaded) return;
    for (const mesh of state.level.meshes) resources.release(mesh);
    state.level.animated.length = 0;
    world.clear();
    state.loadedKey = key;
    state.arenaLoaded = arena;
    state.level = buildLevel(R.scene, world, key, { arena });
    for (const mesh of state.level.meshes) resources.track(mesh);
    state.nav = new NavGrid(world, state.level.bounds, 1).build();
    ctx.level = state.level;
    ctx.nav = state.nav;
    audio.setTune(key === 'mexico' ? 'mexico' : 'district');
  }
  const setArena = (arena) =>
    setLevel(knownMap(net.active ? lobby.map || state.mapKey : state.mapKey), arena);
  function applySettings() {
    const settings = state.settings;
    input.mouseSens = (0.0022 * settings.sens) / 100;
    input.padSensX = (3.4 * settings.sens) / 100;
    input.padSensY = (2.6 * settings.sens) / 100;
    input.invertY = settings.invert;
    preferences.write('sens', settings.sens);
    preferences.write('invert', settings.invert ? '1' : '0');
  }
  audio.setTune(state.mapKey === 'mexico' ? 'mexico' : 'district');
  resources.track(R.scene);
  return {
    resources,
    audio,
    canvas,
    R,
    world,
    state,
    preferences,
    input,
    hud,
    effects,
    ctx,
    game,
    enemies,
    player,
    net,
    remote,
    lobby,
    scores,
    online,
    inMatch,
    shotQueue,
    setLevel,
    setArena,
    applySettings,
  };
}
