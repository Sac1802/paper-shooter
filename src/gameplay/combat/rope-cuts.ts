import { Vector3 } from 'three';
export interface RopeTarget {
  readonly id: string;
  readonly alive: boolean;
  readonly grappling: boolean;
  readonly body: { pos: Vector3 };
  readonly right: Vector3;
  readonly gPoint: Vector3;
}
/** Samples the existing rope cut window; outcomes expose peer identity and a borrowed hit point. */
export class RopeCuts<T extends RopeTarget> {
  private readonly hand = new Vector3();
  private readonly point = new Vector3();
  constructor(
    private readonly targets: () => Iterable<T>,
    private readonly onCut: (id: string, point: Vector3) => void,
  ) {}
  cut(eye: Vector3, direction: Vector3, range: number): boolean {
    let cut = false;
    for (const target of this.targets()) {
      if (!target.alive || !target.grappling) continue;
      this.hand.set(
        target.body.pos.x + target.right.x * 0.35,
        target.body.pos.y + 1.25,
        target.body.pos.z + target.right.z * 0.35,
      );
      for (let index = 0; index <= 14; index++) {
        this.point.lerpVectors(this.hand, target.gPoint, index / 14).sub(eye);
        const along = this.point.dot(direction);
        if (along < 0.3 || along > range) continue;
        const lateral = Math.sqrt(Math.max(0, this.point.lengthSq() - along * along));
        if (lateral > 0.9) continue;
        this.point.add(eye);
        this.onCut(target.id, this.point);
        cut = true;
        break;
      }
    }
    return cut;
  }
}
