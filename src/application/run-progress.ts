import type { PreferencePort, SavedPreferences } from '../platform/preferences.js';
/** Owns persisted solo records, independent of screen markup, input and actor state. */
export class RunProgress {
  constructor(
    private readonly state: Pick<SavedPreferences, 'best' | 'checkpoint'>,
    private readonly preferences: Pick<PreferencePort, 'write'>,
  ) {}
  get best() {
    return this.state.best;
  }
  get checkpoint() {
    return this.state.checkpoint;
  }
  saveCheckpoint(wave: number) {
    this.state.checkpoint = wave;
    this.preferences.write('checkpoint', String(wave));
  }
  recordBest(score: number) {
    const improved = score > this.state.best;
    if (improved) {
      this.state.best = score;
      this.preferences.write('best', String(this.state.best));
    }
    return improved;
  }
}
