// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { applicationFixture } from '../support/application.js';
import { peerNetwork, flushMessages } from '../support/peer-network.js';
import { Net } from '../../src/network/peer-transport.js';
const fixtures = [];
afterEach(() => {
  for (const fixture of fixtures) fixture.app.dispose();
  fixtures.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
});
it(
  'recovers a silent host without losing the successor identity before election',
  { timeout: 10000 },
  async () => {
    vi.useFakeTimers();
    const { Peer } = peerNetwork();
    const make = () => {
      const fixture = applicationFixture('district', {
        net: new Net({
          PeerClass: Peer,
          options: async () => ({}),
          namespace: 'silent-host-test-',
        }),
      });
      fixtures.push(fixture);
      return fixture;
    };
    const host = make(),
      successor = make();
    await host.app.multiplayer.createLobby(false);
    const code = host.net.code,
      hostId = host.net.id;
    await successor.app.multiplayer.joinLobby(code);
    await flushMessages();
    host.app.session.hostStart();
    await flushMessages();
    const channel = successor.net.conns.get(hostId);
    // Simulate a lost endpoint with no data or close/error event delivered to its follower.
    channel.open = false;
    channel.other.open = false;
    host.net.peer.destroy();
    successor.remote.get(hostId).lastSeen = 1;
    await vi.advanceTimersByTimeAsync(10001);
    successor.app.multiplayer.netUpdate(0.016);
    await flushMessages();
    await vi.advanceTimersByTimeAsync(1600);
    await flushMessages();
    expect(successor.net.isHost).toBe(true);
    expect(successor.net.code).toBe(code + '-1');
    expect(successor.game.state).toBe('play');
    expect(successor.remote.has(hostId)).toBe(false);
  },
);
