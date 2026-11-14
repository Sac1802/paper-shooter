import { expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { TYPES } from '../../src/domain/enemies.js';
import { buildEnemyModel } from '../../src/presentation/models/enemy.js';
import { EnemyDisassembly } from '../../src/presentation/characters/disassembly.js';
import type { DisassemblyPorts } from '../../src/presentation/characters/disassembly-contracts.js';
function fixture(kind: 'shield' | 'grunt') {
  const rig = buildEnemyModel(TYPES[kind]);
  if (rig.kind !== 'walking') throw Error('Expected a walking rig');
  const scene = new Scene();
  scene.add(rig.root);
  const pose = { position: new Vector3(), center: rig.center, yaw: () => 0.7 },
    ports: DisassemblyPorts = {
      scene,
      effects: { debris: vi.fn(), fountain: vi.fn(), bloodPool: vi.fn(), blood: vi.fn() },
      audio: { gib: vi.fn(), shieldHit: vi.fn() },
      shieldBroken: vi.fn(),
    };
  const disassembly = new EnemyDisassembly(TYPES[kind], rig, pose, ports);
  return { rig, scene, pose, ports, disassembly };
}
it('transfers the shield, refreshes hit regions once and leaves scoring to its caller', () => {
  const { rig, scene, pose, ports, disassembly } = fixture('shield'),
    shield = rig.J.shieldG;
  expect(shield).not.toBeNull();
  expect(rig.hit.some(([part]) => part === 'shield')).toBe(true);
  expect(disassembly.breakShield()).toBe(true);
  expect(shield?.parent).toBe(scene);
  expect(rig.J.shieldG).toBeNull();
  expect(rig.hit.some(([part]) => part === 'shield')).toBe(false);
  expect(rig.hitSpheres).toHaveLength(rig.hit.length);
  expect(disassembly.breakShield()).toBe(false);
  expect(ports.effects.debris).toHaveBeenCalledOnce();
  expect(ports.audio.shieldHit).toHaveBeenCalledExactlyOnceWith(pose.center);
  expect(ports.shieldBroken).not.toHaveBeenCalled();
});
it('emits shield-break feedback once during corpse disassembly and updates only the owned corpse pose afterward', () => {
  const { rig, pose, ports, disassembly } = fixture('shield');
  vi.mocked(Math.random).mockReturnValue(0.9);
  const position = pose.position.clone(),
    center = pose.center.clone();
  disassembly.perform({ source: 'rifle' }, new Vector3(0, 0, 1), { sever: false, extreme: false });
  expect(ports.shieldBroken).toHaveBeenCalledOnce();
  expect(ports.audio.gib).not.toHaveBeenCalled();
  expect(ports.effects.bloodPool).toHaveBeenCalledOnce();
  expect(ports.effects.blood).toHaveBeenCalledOnce();
  disassembly.update(1, 1);
  expect(rig.root.rotation.y).toBe(0.7);
  disassembly.update(1, 10);
  expect(rig.root.scale.x).toBe(0.001);
  expect(pose.position).toEqual(position);
  expect(pose.center).toEqual(center);
  expect(ports.effects.bloodPool).toHaveBeenCalledOnce();
  expect(ports.shieldBroken).toHaveBeenCalledOnce();
});
