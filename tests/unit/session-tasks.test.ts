import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTasks } from '../../src/application/session-tasks.js';
afterEach(() => vi.useRealTimers());
describe('session generation ownership', () => {
  it('releases retry timers and settles a cancelled wait without executing its retry', async () => {
    vi.useFakeTimers();
    const tasks = new SessionTasks();
    const old = tasks.begin('migrate')!;
    const retry = old.wait(1200);
    expect(vi.getTimerCount()).toBe(1);
    tasks.cancel();
    expect(await retry).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(await old.wait(100)).toBe(false);
  });
  it('does not let stale completion finish a newer migration', async () => {
    vi.useFakeTimers();
    const tasks = new SessionTasks();
    const old = tasks.begin('connect')!;
    const current = tasks.begin('migrate')!;
    tasks.finish(old);
    expect(tasks.migrating).toBe(true);
    const delay = current.wait(800);
    await vi.advanceTimersByTimeAsync(800);
    expect(await delay).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    tasks.finish(current);
    expect(tasks.migrating).toBe(false);
    // Follow-up events (e.g. reclaiming an alias) still belong to this generation.
    expect(current.current).toBe(true);
    tasks.dispose();
    tasks.dispose();
    expect(current.current).toBe(false);
    expect(tasks.begin('connect')).toBeNull();
  });
});
