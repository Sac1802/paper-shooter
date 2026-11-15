import { expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { FocusMarker } from '../../src/presentation/focus-marker.js';

it('projects without mutating the target and reads resized viewports without rebuilding', () => {
  const hud = { setFocusMark: vi.fn() };
  const viewport = { innerWidth: 800, innerHeight: 600 };
  const camera = new PerspectiveCamera(90, 1, 0.1, 100);
  camera.updateMatrixWorld(true);
  const marker = new FocusMarker({ camera, viewport, hud });
  const point = new Vector3(0, 0, -5);
  marker.show(point);
  expect(hud.setFocusMark).toHaveBeenLastCalledWith(400, 300);
  viewport.innerWidth = 1200;
  viewport.innerHeight = 800;
  marker.show(point);
  expect(hud.setFocusMark).toHaveBeenLastCalledWith(600, 400);
  expect(point).toEqual(new Vector3(0, 0, -5));
});

it('clears the marker for targets behind the camera and when focus ends', () => {
  const hud = { setFocusMark: vi.fn() };
  const camera = new PerspectiveCamera(90, 1, 0.1, 100);
  camera.updateMatrixWorld(true);
  const marker = new FocusMarker({ camera, hud, viewport: { innerWidth: 800, innerHeight: 600 } });
  marker.show(new Vector3(0, 0, 5));
  expect(hud.setFocusMark).toHaveBeenLastCalledWith(null);
  marker.show(null);
  expect(hud.setFocusMark).toHaveBeenCalledTimes(2);
});
