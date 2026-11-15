import { Vector3, type Object3D } from 'three';
import { rand } from '../../engine/math.js';
import type { Collider } from '../../engine/physics.js';
import type { PropVisual } from '../../presentation/prop-feedback.js';
export interface Breakable extends PropVisual {
  id: number;
  alive: boolean;
  hp: number;
  box: Collider;
}
export interface PropCombatPorts {
  props(): readonly Breakable[];
  lookup(id: number): Breakable | undefined;
  world: { removeBox(box: Collider): void };
  feedback: {
    hit(point: Vector3, ink: number): void;
    discard(group: Object3D): void;
    shatter(prop: PropVisual, direction: Vector3): void;
    finish(prop: PropVisual): void;
  };
  canDrop(): boolean;
  dropHealth(point: Vector3): void;
  solo(): boolean;
  score(points: number, label: string): void;
  broken(id: number): void;
}
/** Checks current prop handles and owns health and break/loot policy; presentation and network reports are commands. */
export class PropCombat {
  private readonly direction = new Vector3();
  constructor(private readonly ports: PropCombatPorts) {}
  private resolve(reference: { id: number }): Breakable | null {
    const prop = this.ports.lookup(reference.id);
    return prop === reference ? prop : null;
  }
  damage(reference: { id: number }, amount: number, point: Vector3, direction: Vector3) {
    const prop = this.resolve(reference);
    if (!prop?.alive) return;
    prop.hp -= amount;
    if (prop.hp <= 0) this.break(prop, direction, true);
    else this.ports.feedback.hit(point, prop.ink);
  }
  inArc(position: Vector3, direction: Vector3, range: number, cosHalf: number): Breakable[] {
    return this.ports.props().filter((prop) => {
      if (!prop.alive) return false;
      this.direction.subVectors(prop.pos, position);
      const distance = this.direction.length();
      return (
        distance < range + 0.5 &&
        (distance < 0.4 || this.direction.divideScalar(distance).dot(direction) > cosHalf)
      );
    });
  }
  blast(point: Vector3, radius: number) {
    for (const prop of this.ports.props())
      if (prop.alive && prop.pos.distanceTo(point) < radius * 0.9)
        this.break(prop, prop.pos.clone().sub(point).normalize(), true);
  }
  break(prop: Breakable, direction: Vector3 | null, local: boolean, quiet = false) {
    if (!prop.alive) return;
    prop.alive = false;
    this.ports.world.removeBox(prop.box);
    const point = prop.pos;
    const impulse =
      direction && direction.lengthSq() > 0.01
        ? direction.clone().normalize()
        : new Vector3(rand(-1, 1), 1, rand(-1, 1)).normalize();
    if (quiet) {
      this.ports.feedback.discard(prop.group);
      return;
    }
    this.ports.feedback.shatter(prop, impulse);
    if (prop.kind === 'pinata') {
      if (this.ports.canDrop())
        for (let index = 0; index < 2; index++)
          this.ports.dropHealth(
            point.clone().add(new Vector3(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))),
          );
      if (this.ports.solo()) this.ports.score(25, 'PIÑATA');
    }
    this.ports.feedback.finish(prop);
    if (local) this.ports.broken(prop.id);
  }
}
