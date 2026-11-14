export interface PopulationEnemy {
  id: number;
  type: string;
  alive: boolean;
  state: string;
  deadT: number;
}
/** Owns membership, identity allocation, live count and corpse retirement; no render/combat dependencies. */
export class EnemyPopulation<E extends PopulationEnemy = PopulationEnemy> {
  private readonly list: E[] = [];
  private readonly index = new Map<number, E>();
  private live = 0;
  private nextId = 1;
  get entries(): readonly E[] {
    return this.list;
  }
  get byId(): ReadonlyMap<number, E> {
    return this.index;
  }
  get alive() {
    return this.live;
  }
  allocateId() {
    return this.nextId++;
  }
  add(entity: E) {
    this.index.set(entity.id, entity);
    this.list.push(entity);
    if (entity.alive) this.live++;
  }
  markDead(entity: E) {
    if (!entity.alive || this.index.get(entity.id) !== entity) return false;
    entity.alive = false;
    entity.state = 'dead';
    entity.deadT = 0;
    this.live--;
    return true;
  }
  count(kind: E['type']) {
    let count = 0;
    for (const entity of this.list) if (entity.alive && entity.type === kind) count++;
    return count;
  }
  retire(maximumAge: number, release: (entity: E) => void) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const entity = this.list[i];
      if (entity.alive || entity.deadT <= maximumAge) continue;
      release(entity);
      this.list.splice(i, 1);
      this.index.delete(entity.id);
    }
  }
  clear(release: (entity: E) => void) {
    for (const entity of this.list) release(entity);
    this.list.length = 0;
    this.live = 0;
    this.index.clear();
  }
}
