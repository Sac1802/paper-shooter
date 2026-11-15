import { PropCombat } from '../gameplay/combat/props.js';
import { PropFeedback } from '../presentation/prop-feedback.js';
import { PvpDamage } from '../gameplay/combat/pvp-damage.js';
import { GrenadeBlast } from '../gameplay/combat/grenade-blast.js';
import { RopeCuts } from '../gameplay/combat/rope-cuts.js';
import { PlayerQueries } from '../gameplay/combat/player-queries.js';
import { INK } from '../shared/ink.js';

export function createCombat(runtime, actions = {}) {
  const audio = runtime.audio;
  const {
    ctx,
    player,
    remote,
    online,
    world,
    effects,
    hud,
    input,
    net,
    game,
    R,
    inMatch,
    shotQueue,
  } = runtime;
  const { spawnPickup } = actions;
  const blast = new GrenadeBlast({
    local: player,
    targets: () => ctx.targets(),
    canHurt: (target) => ctx.canHurt(target),
    present: (point, radius) => {
      effects.boom(point, radius);
      audio.explosion(point);
      input.rumble(0.9, 0.9, 220);
    },
    enemies: (point, radius, damage) => ctx.enemies.blastEnemies(point, radius, damage, null),
    props: (point, radius) => ctx.blastBreakables?.(point, radius),
  });
  player.grenadeSystem.onExplosion = (point, mine) => blast.explode(point, mine);
  // anything a bullet or a blade can hit besides enemies
  ctx.targets = () => [player, ...remote.values()];
  ctx.canHurt = (t) => online() && t !== player;
  const queries = new PlayerQueries(
    () => remote.values(),
    (target) => ctx.canHurt(target),
    world,
  );
  ctx.raycastPlayers = (...args) => queries.raycast(...args);
  ctx.playersInArc = (...args) => queries.inArc(...args);
  const pvp = new PvpDamage({
    canHurt: (target) => ctx.canHurt(target),
    local: player,
    postponeMelee: (duration) => {
      const blade = player.weapons[player.katanaIndex];
      if (blade.kind === 'katana') blade.cooldown = Math.max(blade.cooldown, duration);
    },
    hitstop: (duration, scale) => game.hitstop(duration, scale),
    effects,
    audio,
    hud,
    rumble: (...args) => input.rumble(...args),
    reportGuard: (id, returned) => net.sendTo(id, 'parry', { ret: returned, by: net.id }),
    reportDamage: (id, amount, origin, critical, source) =>
      net.sendTo(id, 'pdmg', {
        amount: Math.round(amount),
        from: origin.toArray().map((value) => +value.toFixed(1)),
        by: net.id,
        crit: critical,
        src: source,
      }),
  });
  ctx.hitPlayer = (...args) => pvp.hit(...args);
  const ropes = new RopeCuts(
    () => remote.values(),
    (id, point) => {
      effects.strokeBurst(point, INK.ORANGE, 10, 5, { life: 0.25, size: 0.035 });
      net.sendTo(id, 'cut', {});
      hud.tip('ROPE CUT', 0.9);
    },
  );
  ctx.cutRopes = (...args) => ropes.cut(...args);
  const props = new PropCombat({
    props: () => runtime.state.level.breakables,
    lookup: (id) => runtime.state.level.breakables[id],
    world,
    feedback: new PropFeedback(R.scene, runtime.resources, effects, audio),
    canDrop: () => !net.active || net.isHost,
    dropHealth: (point) => spawnPickup('health', point),
    solo: () => game.mode === 'solo',
    score: (points, label) => game.addScore(points, label),
    broken: (id) => {
      if (net.active) net.broadcast('brk', { id });
    },
  });
  ctx.breakHit = (...args) => props.damage(...args);
  ctx.breakablesInArc = (...args) => props.inArc(...args);
  ctx.blastBreakables = (...args) => props.blast(...args);
  const breakProp = (...args) => props.break(...args);
  // every ray a gun fires this tick is sent to the others, who draw it as a tracer from the shooter's gun

  ctx.onShot = (end) => {
    if (net.active && inMatch())
      shotQueue.push(+end.x.toFixed(1), +end.y.toFixed(1), +end.z.toFixed(1));
  };

  return { breakProp };
}
