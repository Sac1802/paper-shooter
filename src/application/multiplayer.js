import * as THREE from 'three';
import { LobbyConnection } from './lobby-connection.js';
import { connectionError } from '../presentation/network-errors.js';
import { INK } from '../shared/ink.js';
import { RemotePlayer } from '../gameplay/remote-player.js';
import { knownMap } from '../domain/maps';
import { IdlePlayers } from './idle-players.js';
import { MatchClock } from './match-clock.js';
import { NetworkSync } from './network-sync.js';
import { CombatMessages } from './combat-messages.js';
import { NetworkCombatFeedback } from '../presentation/network-combat-feedback.js';

export function createMultiplayer(runtime, actions = {}) {
  const audio = runtime.audio;
  const {
    remote,
    remoteServices,
    hud,
    net,
    lobby,
    scores,
    inMatch,
    game,
    player,
    input,
    effects,
    online,
    shotQueue,
  } = runtime;
  const {
    renderLobby,
    sendScores,
    refreshScoreHud,
    farthestSpawnIndex,
    startMatch,
    breakProp,
    hostStart,
    endMatch,
    toLobbyScreen,
    spawnPickup,
    removePickup,
    tallyDeath,
    applyScores,
    sortedScores,
    session,
    connectionPresentation,
  } = actions;
  const connection = new LobbyConnection({
    transport: net,
    lobby,
    scores,
    local: runtime.state,
    removeRemote: (id) => removeRemote(id),
    remoteIds: () => remote.keys(),
    inMatch,
    broadcastLobby: () => broadcastLobby(),
    session,
    presentation: connectionPresentation,
  });
  const leaveOnline = (reason) => connection.leaveOnline(reason);
  const migrateHost = () => connection.migrateHost();
  const combatFeedback = new NetworkCombatFeedback({
    player,
    opponents: remote,
    effects,
    audio,
    input,
    hud,
  });
  const combatMessages = new CombatMessages({
    player,
    game,
    transport: net,
    scores,
    opponents: remote,
    feedback: {
      death: (point) => audio.enemyDie(point),
      kill: () => audio.kill(true),
      feed: (text) => hud.kill(text, 0),
      parry: (returned) => combatFeedback.parry(returned),
      cut: () => combatFeedback.cut(),
    },
    tally: tallyDeath,
  });

  function addRemote(id, name) {
    if (remote.has(id)) {
      const r = remote.get(id);
      r.name = name;
      return r;
    }
    const rp = new RemotePlayer(remoteServices, id, name, 0, INK.RED);
    rp.onDamage = (t, amount, fromPos) => {
      if (!runtime.combat.canHurt(t) || !t.alive) return;
      hud.hitmarker(false, false);
      net.sendTo(t.id, 'pdmg', {
        amount: Math.round(amount),
        from: fromPos ? fromPos.toArray().map((v) => +v.toFixed(1)) : null,
        by: net.id,
        src: 'grenade',
      });
    };
    remote.set(id, rp);
    return rp;
  }
  function removeRemote(id) {
    const r = remote.get(id);
    if (r) {
      r.dispose();
      remote.delete(id);
    }
    lobby.players.delete(id);
    scores.delete(id);
  }
  function lobbyRows() {
    return [...lobby.players.entries()].map(([id, p]) => ({ id, name: p.name }));
  }
  function broadcastLobby() {
    net.send('lobby', {
      players: lobbyRows(),
      hostId: net.id,
      isPublic: lobby.isPublic,
      map: lobby.map || runtime.state.mapKey,
      shown: net.aliasCode || net.code,
    });
    renderLobby();
  }

  net.onPeerLeave = (id) => {
    const nm = (lobby.players.get(id) || {}).name;
    removeRemote(id);
    broadcastLobby();
    if (inMatch()) {
      hud.kill((nm || 'someone') + ' left', 0);
      sendScores();
    }
  };
  net.onDisconnect = () => {
    if (lobby.order && lobby.order.some((id) => id !== lobby.hostId)) void migrateHost();
    else leaveOnline('the host left the lobby');
  };
  net.on('refused', (d) => leaveOnline(d.reason));
  net.hostName = runtime.state.myName;
  net.onPeerJoin = (from, meta) => {
    const name = typeof meta?.name === 'string' ? meta.name.slice(0, 14) : 'paper';
    if (meta && meta.prev && meta.prev !== from) {
      const sc = scores.get(meta.prev);
      if (sc) {
        scores.delete(meta.prev);
        scores.set(from, sc);
      }
      const r = remote.get(meta.prev);
      if (r) r.dispose();
      remote.delete(meta.prev);
      lobby.players.delete(meta.prev);
      if (lobby.order) lobby.order = lobby.order.filter((id) => id !== meta.prev);
    }
    lobby.players.set(from, { name });
    addRemote(from, name);
    broadcastLobby();
    if (game.state === 'play' || game.state === 'dying') {
      if (!scores.has(from)) scores.set(from, { name, kills: 0, deaths: 0 });
      net.sendTo(from, 'start', {
        late: true,
        spawn: farthestSpawnIndex(),
        map: lobby.map || runtime.state.mapKey,
        broken: runtime.state.level.breakables.filter((b) => !b.alive).map((b) => b.id),
      });
      sendScores();
      hud.kill(name + ' joined', 0);
    }
  };
  net.onHost('lobby', (d) => {
    lobby.hostId = d.hostId;
    lobby.isPublic = !!d.isPublic;
    lobby.code = net.code;
    lobby.shown = d.shown || net.code;
    if (d.map) lobby.map = knownMap(d.map);
    lobby.order = d.players.map((p) => p.id);
    lobby.players.clear();
    for (const p of d.players) lobby.players.set(p.id, { name: p.name });
    for (const p of d.players) if (p.id !== net.id) addRemote(p.id, p.name);
    for (const id of [...remote.keys()]) if (!lobby.players.has(id)) removeRemote(id);
    if (inMatch()) {
      for (const p of d.players)
        if (!scores.has(p.id)) scores.set(p.id, { name: p.name, kills: 0, deaths: 0 });
      refreshScoreHud();
    }
    renderLobby();
  });
  net.onHost('leave', (d) => {
    const nm = (lobby.players.get(d.id) || {}).name;
    removeRemote(d.id);
    if (inMatch()) hud.kill((nm || 'someone') + ' left', 0);
    renderLobby();
  });
  net.onHost('start', (d) => {
    if (net.isHost) return;
    if (d.map) lobby.map = knownMap(d.map);
    startMatch(!!d.late, d.spawns ? d.spawns[net.id] : d.spawn);
    if (d.broken)
      for (const id of d.broken) {
        const br = runtime.state.level.breakables[id];
        if (br) breakProp(br, null, false, true);
      }
  });
  net.on('startreq', () => {
    if (net.isHost && game.state === 'lobby') hostStart();
  });
  net.onHost('end', (d) => endMatch(d));
  net.onHost('backtolobby', () => {
    if (!net.isHost) toLobbyScreen();
  });
  net.onHost('pickup', (d) => {
    if (!net.isHost) spawnPickup(d.kind, new THREE.Vector3().fromArray(d.pos), d.id);
  });
  net.onHost('taken', (d) => {
    const p = runtime.state.pickups.find((x) => x.id === d.id);
    if (p) removePickup(p);
  });
  net.on('take', (d) => {
    if (!net.isHost) return;
    const p = runtime.state.pickups.find((x) => x.id === d.id);
    if (p) {
      removePickup(p);
      net.send('taken', { id: d.id });
    }
  });
  net.on('ps', (d, from) => {
    const r = remote.get(from);
    if (r) {
      r.push(d, performance.now() / 1000);
      r.lastSeen = performance.now();
    }
  });
  net.on('pdmg', (data, sender) => combatMessages.damage(data, sender));
  net.on('pdead', (data, sender) => combatMessages.death(data, sender));
  net.on('nade', (data) => combatMessages.grenade(data));
  net.on('brk', (d) => {
    const br = runtime.state.level.breakables[d.id];
    if (br) breakProp(br, null, false);
  });
  net.on('parry', (data) => combatMessages.parry(data));
  net.on('shots', (data, sender) => combatFeedback.shots(data.k, data.e, sender));
  net.on('cut', () => combatMessages.cut());
  net.onHost('score', (rows) => {
    if (!net.isHost) applyScores(rows);
  });
  net.on('fell', (d, from) => {
    if (!net.isHost) return;
    const sc = scores.get(from);
    if (sc) {
      sc.kills = Math.max(0, sc.kills - 1);
      sendScores();
      net.send('feed', { text: sc.name + ' fell off the page · -1' });
      hud.kill(sc.name + ' fell off the page · -1', 0);
    }
  });
  net.onHost('feed', (d) => hud.kill(String(d.text || ''), 0));
  player.onFall = () => {
    if (!online() || !inMatch()) return;
    hud.kill('fell off the page · -1 kill', 0);
    if (net.isHost) {
      const sc = scores.get(net.id);
      if (sc) {
        sc.kills = Math.max(0, sc.kills - 1);
        sendScores();
        net.send('feed', { text: sc.name + ' fell off the page · -1' });
      }
    } else net.send('fell', {});
  };
  const clock = new MatchClock({
    state: runtime.state,
    game,
    transport: net,
    inMatch,
    opponentCount: () => remote.size,
    localName: () => runtime.state.myName,
    sortedScores,
    timer: (text) => hud.setTimer(text),
    end: endMatch,
  });
  const idle = new IdlePlayers({
    transport: net,
    opponents: () => remote.entries(),
    inMatch,
    idleSeconds: () => input.idleSeconds,
    now: () => performance.now(),
    warn: () => {
      hud.message('STILL THERE?', 'move or you get kicked for inactivity', 3);
      audio.empty();
    },
    leave: leaveOnline,
    rejoin: (code) => {
      lobby.rejoinCode = code;
      if (code) connectionPresentation.start();
    },
    kick: (id) => {
      net.sendTo(id, 'kick', { reason: 'kicked for inactivity' });
      const connection = net.conns.get(id);
      setTimeout(() => {
        try {
          connection?.close();
        } catch {
          /* The channel may already be closed. */
        }
      }, 500);
    },
  });
  const sync = new NetworkSync({
    transport: net,
    player,
    opponents: () => remote.entries(),
    shotQueue,
    inMatch,
    migrating: () => connection.migrating,
    idleSeconds: () => input.idleSeconds,
    now: () => performance.now(),
    idle: (dt) => idle.update(dt),
    clock: (dt) => clock.update(dt),
    remove: removeRemote,
    migrate: migrateHost,
    feed: (text) => hud.kill(text, 0),
    broadcastLobby,
    sendScores,
  });
  net.onHost('clock', (data) => clock.receive(data));
  net.onHost('kick', (data) => idle.kicked(data.reason));
  function dispose() {
    net.onPeerJoin = null;
    net.onPeerLeave = null;
    net.onDisconnect = null;
    connection.dispose();
  }

  return {
    cancelPending: () => connection.cancelPending(),
    dispose,
    addRemote,
    removeRemote,
    lobbyRows,
    broadcastLobby,
    migrateHost,
    idleUpdate: (dt) => idle.update(dt),
    netUpdate: (dt) => sync.update(dt),
    leaveOnline,
    createLobby: (isPublic) => connection.createLobby(isPublic),
    joinLobby: (code) => connection.joinLobby(code),
    quickPlay: () => connection.quickPlay(),
    friendlyError: connectionError,
    setStatus: (message) => connection.setStatus(message),
  };
}
