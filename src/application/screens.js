import * as views from '../presentation/screen-views.js';
import { escapeHtml as esc } from '../presentation/html';

export function createScreens(runtime, actions = {}) {
  const { hud, preferences, net, lobby, game, online } = runtime;
  const {
    cancelPending,
    lobbyRows,
    friendlyError,
    quickPlay,
    createLobby,
    setStatus,
    joinLobby,
    broadcastLobby,
    hostStart,
    leaveOnline,
    beginAtWave,
    begin,
    sortedScores,
    toMainMenu,
    settingsPanel,
  } = actions;
  // ---------------- screens ----------------
  const settingsHTML = () => settingsPanel.html();
  const wireSettings = () => settingsPanel.wire(hud.el.panel);
  const wireName = (box) => settingsPanel.wireName(box);
  const checkpointHTML = () => views.checkpointHTML(runtime.state.checkpoint);
  function wireCheckpoints(onGo) {
    const box = hud.el.panel.querySelector('.checkpoints');
    if (!box) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('button');
      if (b) onGo(Number(b.dataset.cp));
    });
  }
  const mapHTML = (selected, canPick) => views.mapHTML(selected, canPick);
  function wireMap(onPick) {
    const box = hud.el.panel.querySelector('#mapsel');
    if (!box) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('.mapbtn');
      if (b && !b.disabled) onPick(b.dataset.map);
    });
  }

  const mainHTML = () => views.mainHTML(runtime.state, settingsHTML());
  const onlineHTML = () =>
    views.onlineHTML({ myName: runtime.state.myName, ...lobby }, lobbyListHTML());
  const lobbyHTML = () =>
    views.lobbyHTML({
      rows: lobbyRows(),
      host: net.isHost,
      localId: net.id,
      hostId: lobby.hostId,
      code: net.isHost ? net.aliasCode || net.code : lobby.shown || net.code || '',
      mapKey: lobby.map || runtime.state.mapKey,
      maxPlayers: net.maxPlayers,
      isPublic: lobby.isPublic,
      status: lobby.status,
    });
  let lobbyList = null,
    listBusy = false,
    disposed = false;
  const lobbyListHTML = () => views.lobbyListHTML({ busy: listBusy, rows: lobbyList });
  async function refreshLobbies() {
    if (disposed || listBusy || net.active) return;
    listBusy = true;
    const box = hud.el.panel.querySelector('#lobbyRows');
    if (box) box.innerHTML = lobbyListHTML();
    let err = null;
    try {
      const found = await net.listLobbies({ name: runtime.state.myName });
      if (disposed) return;
      lobbyList = found;
    } catch (e) {
      if (disposed) return;
      lobbyList = [];
      err = e;
    }
    listBusy = false;
    const rows = hud.el.panel.querySelector('#lobbyRows');
    if (rows)
      rows.innerHTML = err
        ? `<div class="hint">could not look: ${esc(friendlyError(err))}</div>`
        : lobbyListHTML();
  }
  function wireOnline() {
    const box = hud.el.panel.querySelector('#online');
    if (!box) return;
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('keydown', (e) => e.stopPropagation());
    const q = (id) => box.querySelector('#' + id);
    wireName(box);
    if (q('quickBtn'))
      q('quickBtn').addEventListener('click', () => {
        lockButtons(box);
        quickPlay();
      });
    if (q('createBtn'))
      q('createBtn').addEventListener('click', () => {
        lockButtons(box);
        createLobby(box.querySelector('input[name=vis]:checked').value === 'public');
      });
    if (q('joinBtn')) {
      q('joinBtn').addEventListener('click', () => {
        const c = q('codeBox').value.trim().toUpperCase();
        if (!c) {
          setStatus('type the code your friend gave you');
          return;
        }
        lockButtons(box);
        joinLobby(c);
      });
      q('codeBox').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') q('joinBtn').click();
      });
    }
    if (q('rejoinBtn'))
      q('rejoinBtn').addEventListener('click', () => {
        const c = lobby.rejoinCode;
        lobby.rejoinCode = null;
        lockButtons(box);
        joinLobby(c);
      });
    if (q('backBtn'))
      q('backBtn').addEventListener('click', () => {
        cancelPending();
        lobby.status = '';
        lobby.rejoinCode = null;
        runtime.state.screen = 'main';
        showStart();
      });
    if (q('refreshBtn')) {
      q('refreshBtn').addEventListener('click', () => void refreshLobbies());
      if (!lobbyList && !listBusy) void refreshLobbies();
    }
    if (q('lobbyRows'))
      q('lobbyRows').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-join]');
        if (b) {
          lockButtons(box);
          joinLobby(b.dataset.join);
        }
      });
    wireMap((k) => {
      if (net.isHost) {
        lobby.map = k;
        broadcastLobby();
      }
    });
    if (q('startBtn'))
      q('startBtn').addEventListener('click', () => {
        if (net.isHost) hostStart();
        else {
          net.send('startreq', {});
          setStatus('asking the host to start…');
        }
      });
    if (q('leaveBtn'))
      q('leaveBtn').addEventListener('click', () => {
        lobby.rejoinCode = null;
        leaveOnline('');
      });
  }
  function lockButtons(box) {
    for (const b of box.querySelectorAll('button')) if (b.id !== 'backBtn') b.disabled = true;
  }
  function showConnectionStatus(message) {
    const status = hud.el.panel.querySelector('#status');
    if (status) status.textContent = message;
  }
  function unlockButtons() {
    const box = hud.el.panel.querySelector('#online');
    if (box) for (const b of box.querySelectorAll('button')) b.disabled = false;
  }
  function renderLobby() {
    if (game.state === 'lobby') showStart();
  }
  function showStart() {
    hud.setGameplayVisible(false);
    if (game.state === 'lobby') runtime.state.screen = 'lobby';
    const html =
      runtime.state.screen === 'lobby'
        ? lobbyHTML()
        : runtime.state.screen === 'online'
          ? onlineHTML()
          : mainHTML();
    hud.showScreen(html);
    const p = hud.el.panel;
    if (runtime.state.screen === 'main') {
      wireSettings();
      wireCheckpoints((w) => beginAtWave(w));
      wireMap((k) => {
        runtime.state.mapKey = k;
        preferences.write('map', k);
        showStart();
      });
      p.querySelector('#soloBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        begin();
      });
      p.querySelector('#onlineBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        runtime.state.screen = 'online';
        showStart();
      });
    } else wireOnline();
  }
  function showPause() {
    if (online()) {
      hud.showScreen(
        views.pauseOnlineHTML(
          {
            code: String(net.aliasCode || net.code || ''),
            localId: net.id,
            scores: sortedScores(),
          },
          settingsHTML(),
          hud.key('confirm'),
        ),
      );
      wireSettings();
      wireOnline();
      return;
    }
    hud.showScreen(views.pauseSoloHTML(game, settingsHTML(), hud.key('confirm')));
    wireSettings();
    wireMenuBtn();
  }
  const showClickToPlay = () => hud.showScreen(views.clickToPlayHTML(hud.key('confirm')));
  function showDead() {
    hud.setGameplayVisible(false);
    const nb = game.score > runtime.state.best;
    if (nb) {
      runtime.state.best = game.score;
      preferences.write('best', String(runtime.state.best));
    }
    hud.showScreen(
      views.deathHTML(
        { ...game, best: runtime.state.best, checkpoint: runtime.state.checkpoint },
        nb,
        hud.key('confirm'),
      ),
    );
    wireCheckpoints((w) => beginAtWave(w));
    wireMenuBtn();
  }
  const menuBtnHTML = () => views.menuBtnHTML();
  function wireMenuBtn() {
    const b = hud.el.panel.querySelector('#menuBtn');
    if (b)
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        toMainMenu();
      });
  }

  return {
    dispose: () => {
      disposed = true;
    },
    settingsHTML,
    wireSettings,
    wireName,
    checkpointHTML,
    wireCheckpoints,
    mapHTML,
    wireMap,
    mainHTML,
    onlineHTML,
    lobbyHTML,
    lobbyListHTML,
    refreshLobbies,
    wireOnline,
    lockButtons,
    showConnectionStatus,
    unlockButtons,
    renderLobby,
    showStart,
    showPause,
    showClickToPlay,
    showDead,
    menuBtnHTML,
    wireMenuBtn,
  };
}
