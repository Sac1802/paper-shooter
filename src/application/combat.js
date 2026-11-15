import * as THREE from 'three';
import { PvpDamage } from '../gameplay/combat/pvp-damage.js';
import { GrenadeBlast } from '../gameplay/combat/grenade-blast.js';
import { RopeCuts } from '../gameplay/combat/rope-cuts.js';
import { PlayerQueries } from '../gameplay/combat/player-queries.js';
import { INK } from '../shared/ink.js';
import { rand } from '../engine/math.js';

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
  const _v = new THREE.Vector3();
  // breakable props: bullets, blades and blasts break them, and everyone in a match sees it go
  ctx.breakHit = (br, dmg, point, dir) => {
    if (!br.alive) return;
    br.hp -= dmg;
    if (br.hp <= 0) breakProp(br, dir, true);
    else {
      effects.strokeBurst(point, br.ink, 5, 4, { life: 0.2, size: 0.03 });
      audio.shieldHit(point);
    }
  };
  ctx.breakablesInArc = (pos, dir, range, cosHalf) =>
    runtime.state.level.breakables.filter((br) => {
      if (!br.alive) return false;
      _v.subVectors(br.pos, pos);
      const d = _v.length();
      return d < range + 0.5 && (d < 0.4 || _v.divideScalar(d).dot(dir) > cosHalf);
    });
  ctx.blastBreakables = (c, R) => {
    for (const br of runtime.state.level.breakables)
      if (br.alive && br.pos.distanceTo(c) < R * 0.9)
        breakProp(br, br.pos.clone().sub(c).normalize(), true);
  };
  function breakProp(br, dir, local, quiet = false) {
    if (!br.alive) return;
    br.alive = false;
    world.removeBox(br.box);
    const g = br.group,
      pos = br.pos;
    const d =
      dir && dir.lengthSq() > 0.01
        ? dir.clone().normalize()
        : new THREE.Vector3(rand(-1, 1), 1, rand(-1, 1)).normalize();
    if (quiet) {
      runtime.resources.release(g);
      return;
    }
    g.updateMatrixWorld(true);
    for (const child of [...g.children]) {
      child.updateWorldMatrix(true, false);
      R.scene.attach(child);
      const v = d.clone().multiplyScalar(rand(2, 6));
      v.x += rand(-3, 3);
      v.z += rand(-3, 3);
      v.y += rand(2.5, 6.5);
      effects.debris(
        child,
        child.position,
        v,
        new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
        { radius: 0.14, blood: false, life: rand(6, 9) },
      );
    }
    runtime.resources.release(g);
    const up = new THREE.Vector3(0, 1, 0);
    if (br.kind === 'pinata') {
      for (const ink of [INK.PINK, INK.ORANGE, INK.GREEN])
        effects.strokeBurst(pos, ink, 16, 7, { life: 0.7, size: 0.05 });
      effects.explosion(pos, 2.5, INK.PINK);
      if (!net.active || net.isHost)
        for (let i = 0; i < 2; i++)
          spawnPickup(
            'health',
            pos.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))),
          );
      if (game.mode === 'solo') game.addScore(25, 'PIÑATA');
    } else if (br.kind === 'cactus') {
      effects.blood(pos, d, 1.4, { ink: INK.GREEN });
      effects.bloodPool(new THREE.Vector3(pos.x, 0, pos.z), 1.1, INK.GREEN);
    } else {
      effects.strokeBurst(pos, br.ink, 12, 5, { life: 0.35, size: 0.04 });
      effects.smoke(pos, up, 3);
    }
    audio.smash(pos, br.kind === 'barrel' || br.kind === 'crate' || br.kind === 'cactus');
    if (local && net.active) net.broadcast('brk', { id: br.id });
  }
  // every ray a gun fires this tick is sent to the others, who draw it as a tracer from the shooter's gun

  ctx.onShot = (end) => {
    if (net.active && inMatch())
      shotQueue.push(+end.x.toFixed(1), +end.y.toFixed(1), +end.z.toFixed(1));
  };

  return { breakProp };
}
