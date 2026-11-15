export type SessionTaskKind = 'connect' | 'migrate';

/** One session generation; cancellation also releases pending retry timers. */
export class SessionTask {
  constructor(private readonly signal: AbortSignal) {}
  get current(): boolean {
    return !this.signal.aborted;
  }
  wait(milliseconds: number): Promise<boolean> {
    if (!this.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      const finish = (elapsed: boolean) => {
        clearTimeout(timer);
        this.signal.removeEventListener('abort', cancel);
        resolve(elapsed);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(() => finish(true), milliseconds);
      this.signal.addEventListener('abort', cancel, { once: true });
    });
  }
}

/** Latest operation owns completion effects; stale successes/errors cannot alter a later session. */
export class SessionTasks {
  private controller = new AbortController();
  private disposed = false;
  private kind: SessionTaskKind | null = null;
  get migrating(): boolean {
    return this.kind === 'migrate';
  }
  begin(kind: SessionTaskKind): SessionTask | null {
    if (this.disposed) return null;
    this.cancel();
    this.kind = kind;
    return new SessionTask(this.controller.signal);
  }
  finish(task: SessionTask) {
    if (task.current) this.kind = null;
  }
  cancel() {
    this.controller.abort();
    this.controller = new AbortController();
    this.kind = null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
  }
}
