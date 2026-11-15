import { createCombat } from './combat.js';
import { UserSettings } from './user-settings.js';
import { RunProgress } from './run-progress.js';
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
/**
 * @param {import('./contracts.js').ApplicationOptions} options
 * @param {import('./combat-contracts.js').CombatActions} actions
 */
export function createRuntime(options, actions) {
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
  const progress = new RunProgress(state, preferences);
  state.level = buildLevel(R.scene, world, state.mapKey, { arena: false });
  state.nav = new NavGrid(world, state.level.bounds, 1).build();
  const input = options.input ?? new Input(canvas);
  const hud = options.hud ?? new HUD(options.hudRoot);
  const effects = new Effects(R.scene, world, resources);
  /** @type {Player} */
  let player;
  /** @type {import('./combat.js').Combat | null} */
  let combat = null;
  const game = {
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
  };
  const enemies = new EnemyManager({
    scene: R.scene,
    resources,
    world,
    navigation: () => state.nav,
    player: () => player,
    targets: () => targets(),
    effects,
    audio,
    hud,
    input,
    hitstop: (duration, scale) => game.hitstop(duration, scale),
    score: (points, label) => game.addScore(points, label),
  });
  const enemyWeaponQueries = {
    raycast: (...args) => enemies.raycast(...args),
    inArc: (...args) => enemies.inArc(...args),
    damage: (...args) => enemies.damage(...args),
  };
  const playerWeaponQueries = {
    raycast: (...args) => combat?.raycastPlayers(...args) ?? null,
    inArc: (...args) => combat?.playersInArc(...args) ?? [],
    damage: (...args) => combat?.hitPlayer(...args),
  };
  const hitscan = new Hitscan({
    world,
    enemies: enemyWeaponQueries,
    players: playerWeaponQueries,
    breakableHit: (...args) => {
      if (!combat) return false;
      combat.breakHit(...args);
      return true;
    },
    feedback: {
      tracer: (...args) => effects.tracer(...args),
      bulletImpact: (...args) => effects.bulletImpact(...args),
      ricochet: (...args) => audio.ricochet(...args),
      shot: (point) => combat?.onShot(point),
    },
  });
  const meleeImpacts = new MeleeImpacts({
    enemies: enemyWeaponQueries,
    players: playerWeaponQueries,
    ropes: { cut: (...args) => combat?.cutRopes(...args) ?? false },
    props: {
      inArc: (...args) => combat?.breakablesInArc(...args) ?? [],
      damage: (...args) => combat?.breakHit(...args),
    },
  });
  const gunServices = {
    player: () => player,
    impacts: hitscan,
    effects,
    audio,
    input,
    hitstop: (duration, scale) => game.hitstop(duration, scale),
  };
  const bladeServices = {
    player: () => player,
    impacts: meleeImpacts,
    effects,
    audio,
    input,
    hitstop: (duration, scale) => game.hitstop(duration, scale),
  };
  player = new Player({
    environment: {
      scene: R.scene,
      camera: R.camera,
      resources,
      world,
      spawnPoint: () => state.level.playerStart,
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
    weapons: { gun: gunServices, blade: bladeServices },
    grappleQueries: {
      raycastEnemy: (...args) => enemies.raycast(...args),
      enemies: () => enemies.enemies,
      landmarks: () => state.level,
      yank: (...args) => enemies.yank(...args),
    },
    died: () => game.onPlayerDeath(),
  });
  player.name = state.myName;
  const remoteServices = { scene: R.scene, resources, effects, localEye: () => player.eye };
  const net = options.net ?? new Net();
  const userSettings = new UserSettings({
    state,
    preferences,
    input,
    audio,
    player,
    transport: net,
  });
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
  const targets = () => [player, ...remote.values()];
  const combatServices = createCombat(
    {
      player,
      remote,
      targets,
      online,
      inMatch,
      props: () => state.level.breakables,
      lookupProp: (id) => state.level.breakables[id],
      solo: () => game.mode === 'solo',
      world,
      scene: R.scene,
      resources,
      effects,
      audio,
      hud,
      input,
      net,
      shotQueue,
      hitstop: (duration, scale) => game.hitstop(duration, scale),
      score: (points, label) => game.addScore(points, label),
      postponeMelee: (duration) => {
        const blade = player.weapons[player.katanaIndex];
        if (blade.kind === 'katana') blade.cooldown = Math.max(blade.cooldown, duration);
      },
      blastEnemies: (point, radius, damage) => enemies.blastEnemies(point, radius, damage, null),
    },
    actions,
  );
  combat = combatServices;

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
    audio.setTune(key === 'mexico' ? 'mexico' : 'district');
  }
  const setArena = (arena) =>
    setLevel(knownMap(net.active ? lobby.map || state.mapKey : state.mapKey), arena);
  const applySettings = () => userSettings.applyLook();
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
    combat: combatServices,
    gunServices,
    bladeServices,
    remoteServices,
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
    userSettings,
    progress,
  };
}
