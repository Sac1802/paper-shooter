// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { Net } from '../../src/network/peer-transport.js';
function connection() {
  const handlers = new Map();
  const channel = {
    peer: 'other',
    open: true,
    on: (event, handler) => handlers.set(event, handler),
    close: vi.fn(),
    send: vi.fn(),
  };
  return { channel, receive: (data) => handlers.get('data')(data) };
}
const packet = { t: 'pdmg', d: { amount: 25, from: [1, 2, 3] } };
it('ignores a buffered gameplay packet from a connection retired by leaving', () => {
  const net = new Net({ options: async () => ({}), namespace: 'stale-test-' });
  const old = connection();
  const damage = vi.fn();
  net.id = 'host';
  net.isHost = true;
  net.conns.set('other', old.channel);
  net._wire(old.channel);
  net.on('pdmg', damage);
  old.receive(packet);
  expect(damage).toHaveBeenCalledOnce();
  damage.mockClear();
  net.leave();
  old.receive(packet);
  expect(damage).not.toHaveBeenCalled();
});
it('ignores a superseded channel while accepting the current connection for the same peer', () => {
  const net = new Net({ options: async () => ({}), namespace: 'stale-test-' });
  const old = connection(),
    current = connection();
  const damage = vi.fn();
  net.id = 'host';
  net.isHost = true;
  net.conns.set('other', old.channel);
  net._wire(old.channel);
  net.on('pdmg', damage);
  net.conns.set('other', current.channel);
  net._wire(current.channel);
  old.receive(packet);
  expect(damage).not.toHaveBeenCalled();
  current.receive(packet);
  expect(damage).toHaveBeenCalledOnce();
  net.leave();
});
