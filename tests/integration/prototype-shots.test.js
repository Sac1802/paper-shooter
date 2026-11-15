// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { applicationFixture } from '../support/application.js';
let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
});
it('uses numeric fallback tracer widths for unrecognized weapon names accepted by wire decoding', () => {
  fixture = applicationFixture();
  const { app, net, effects } = fixture;
  net.id = 'host';
  net.isHost = true;
  app.multiplayer.addRemote('guest', 'paper');
  const tracer = vi.spyOn(effects, 'tracer');
  for (const kind of ['constructor', 'toString', '__proto__', 'unknown']) {
    tracer.mockClear();
    net._route({ t: 'shots', d: { k: kind, e: [1, 2, 3] } }, 'guest');
    expect(tracer).toHaveBeenCalledOnce();
    expect(tracer.mock.calls[0][3]).toBe(0.02);
    expect(Number.isFinite(fixture.app.runtime.effects.particles.at(-1).size)).toBe(true);
  }
});
it('rejects inherited object properties as unknown kill-source labels', () => {
  fixture = applicationFixture();
  for (const source of ['constructor', 'toString', '__proto__', 'unknown']) {
    expect(fixture.app.match.howWord(source)).toBeNull();
  }
  expect(fixture.app.match.howWord('rifle')).toBe('rifle');
  expect(fixture.app.match.howWord('deflect')).toBe('their own bullet');
});
