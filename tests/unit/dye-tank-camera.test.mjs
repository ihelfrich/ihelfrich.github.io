import test from 'node:test';
import assert from 'node:assert/strict';
import { createTankCamera } from '../../src/scripts/hidden-rivers/tank-camera.mjs';

const tank = { width: 0.24, height: 0.18, depth: 0.18 };

test('section camera keeps physical x right and physical y down at each selected plane', () => {
  const camera = createTankCamera(tank);
  camera.section();
  const frame = camera.getFrame(4 / 3);
  assert.ok(Math.abs(frame.forward[0]) < 1e-12);
  assert.ok(Math.abs(frame.forward[1]) < 1e-12);
  assert.ok(frame.forward[2] < -0.999999);
  const rect = { left: 13, top: 21, width: 720, height: 540 };
  for (const fraction of [0.2, 0.5, 0.8]) {
    const center = { x: .12, y: .09, z: fraction * tank.depth };
    const c = camera.projectToPixel(center, rect);
    const right = camera.projectToPixel({ ...center, x: .16 }, rect);
    const down = camera.projectToPixel({ ...center, y: .13 }, rect);
    assert.ok(right.x > c.x);
    assert.ok(down.y > c.y);
    const picked = camera.pick(right.x, right.y, rect, fraction);
    assert.ok(picked);
    assert.ok(Math.abs(picked.x - .16) < 1e-10);
    assert.ok(Math.abs(picked.y - .09) < 1e-10);
    assert.ok(Math.abs(picked.z - center.z) < 1e-10);
  }
});

test('home camera is oblique and maps tank center to screen center', () => {
  const camera = createTankCamera(tank);
  const home = camera.getCamera();
  assert.ok(Math.abs(home.azimuth) > 0.1);
  assert.ok(home.elevation > 0.1 && home.elevation < 1.2);
  const center = camera.project({ x: tank.width / 2, y: tank.height / 2, z: tank.depth / 2 }, 4 / 3);
  assert.ok(Math.abs(center.x) < 1e-12);
  assert.ok(Math.abs(center.y) < 1e-12);
});

test('project then pick returns the same physical x/y on a selected z plane', () => {
  const camera = createTankCamera(tank);
  const rect = { left: 37, top: 19, width: 720, height: 540 };
  const z = tank.depth * 0.35;
  const point = { x: tank.width * 0.42, y: tank.height * 0.61, z };
  const pixel = camera.projectToPixel(point, rect);
  const picked = camera.pick(pixel.x, pixel.y, rect, z / tank.depth);
  assert.ok(picked, 'the projected in-tank point should be pickable');
  assert.ok(Math.abs(picked.x - point.x) < 1e-10);
  assert.ok(Math.abs(picked.y - point.y) < 1e-10);
  assert.ok(Math.abs(picked.z - z) < 1e-12);
});

test('picking rejects rays that hit the selected depth outside the tank', () => {
  const camera = createTankCamera(tank);
  const rect = { left: 0, top: 0, width: 700, height: 525 };
  assert.equal(camera.pick(-100, 200, rect, 0.5), null);
  assert.equal(camera.pick(350, 200, rect, -0.1), null);
  assert.equal(camera.pick(350, 200, rect, 1.1), null);
});

test('orbit and zoom change only the camera pose, while home restores the default', () => {
  const camera = createTankCamera(tank);
  const initial = camera.getCamera();
  camera.orbit(125, -30);
  const orbited = camera.getCamera();
  assert.notEqual(orbited.azimuth, initial.azimuth);
  assert.notEqual(orbited.elevation, initial.elevation);
  camera.zoom(2);
  assert.ok(camera.getCamera().distance < orbited.distance);
  camera.home();
  assert.deepEqual(camera.getCamera(), initial);
});

test('orbit clamps elevation and zoom clamps distance to usable limits', () => {
  const camera = createTankCamera(tank);
  camera.orbit(0, 1e7);
  assert.ok(camera.getCamera().elevation > 0.02);
  assert.ok(camera.getCamera().elevation < Math.PI / 2 - 0.02);
  camera.zoom(1e-9);
  assert.ok(camera.getCamera().distance > 0);
  camera.zoom(1e9);
  assert.ok(Number.isFinite(camera.getCamera().distance));
});
