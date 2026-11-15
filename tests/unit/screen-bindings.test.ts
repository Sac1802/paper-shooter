// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { BrowserScreens } from '../../src/presentation/screen-bindings.js';
import type { ScreenEvents } from '../../src/presentation/screen-bindings.js';

it('decodes registered map buttons, ignores unknown/disabled maps and handles nested labels', () => {
  const panel = document.createElement('div');
  panel.innerHTML =
    '<div id="mapsel"><button id="invalid" class="mapbtn" data-map="unknown">?</button><button id="valid" class="mapbtn" data-map="mexico"><i>label</i></button><button id="disabled" class="mapbtn" data-map="district" disabled>locked</button></div>';
  const actions: ScreenEvents = {
    begin: vi.fn(),
    online: vi.fn(),
    selectMap: vi.fn(),
    checkpoint: vi.fn(),
    mainMenu: vi.fn(),
    quickPlay: vi.fn(),
    createLobby: vi.fn(),
    joinLobby: vi.fn(),
    rejoin: vi.fn(),
    missingCode: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    pickLobbyMap: vi.fn(),
    startMatch: vi.fn(),
    leave: vi.fn(),
  };
  const browser = new BrowserScreens(
    { el: { panel }, showScreen: vi.fn(), setGameplayVisible: vi.fn(), key: () => 'Enter' },
    { html: () => '', wire: vi.fn(), wireName: vi.fn() },
  );
  browser.bind('main', actions);
  panel.querySelector('#invalid')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  panel.querySelector('#disabled')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(actions.selectMap).not.toHaveBeenCalled();
  panel.querySelector('#valid i')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(actions.selectMap).toHaveBeenCalledOnce();
  expect(actions.selectMap).toHaveBeenCalledWith('mexico');
});
