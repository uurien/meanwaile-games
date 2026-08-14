import test from 'node:test';
import assert from 'node:assert/strict';

import { FrameLoop, HostLifecycle, setTextIfChanged } from './runtime.js';

function fakeAnimationFrames() {
  let nextId = 1;
  const callbacks = new Map();
  const cancelled = [];

  return {
    request(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) {
      cancelled.push(id);
      callbacks.delete(id);
    },
    run(id, now) {
      const callback = callbacks.get(id);
      callbacks.delete(id);
      callback(now);
    },
    pendingIds() {
      return [...callbacks.keys()];
    },
    cancelled,
  };
}

test('FrameLoop starts only one animation frame and duplicate resumes are ignored', () => {
  const frames = fakeAnimationFrames();
  const loop = new FrameLoop({
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
    onFrame: () => true,
  });

  assert.equal(loop.start(), true);
  assert.equal(loop.start(), false);
  assert.equal(frames.pendingIds().length, 1);
  assert.equal(loop.running, true);
});

test('FrameLoop excludes paused time from the next frame delta', () => {
  const frames = fakeAnimationFrames();
  const deltas = [];
  const loop = new FrameLoop({
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
    onFrame: (dt) => {
      deltas.push(dt);
      return true;
    },
  });

  loop.start();
  frames.run(frames.pendingIds()[0], 100);
  frames.run(frames.pendingIds()[0], 125);
  loop.stop();
  loop.start();
  frames.run(frames.pendingIds()[0], 10_000);

  assert.deepEqual(deltas, [0, 25, 0]);
});

test('FrameLoop cancels immediately and stops scheduling when a frame returns false', () => {
  const frames = fakeAnimationFrames();
  let keepRunning = true;
  const loop = new FrameLoop({
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
    onFrame: () => keepRunning,
  });

  loop.start();
  const pendingBeforePause = frames.pendingIds()[0];
  loop.stop();
  assert.deepEqual(frames.cancelled, [pendingBeforePause]);
  assert.equal(frames.pendingIds().length, 0);
  assert.equal(loop.running, false);

  loop.start();
  keepRunning = false;
  frames.run(frames.pendingIds()[0], 200);
  assert.equal(frames.pendingIds().length, 0);
  assert.equal(loop.running, false);
});

test('HostLifecycle starts paused, resumes once, and pauses immediately', () => {
  const calls = [];
  const loop = {
    running: false,
    start() {
      calls.push('start');
      this.running = true;
      return true;
    },
    stop() {
      calls.push('stop');
      this.running = false;
      return true;
    },
  };
  const lifecycle = new HostLifecycle({ loop, isGameOver: () => false });

  assert.equal(lifecycle.paused, true);
  assert.equal(lifecycle.canInteract, false);
  assert.equal(lifecycle.resume(), true);
  assert.equal(lifecycle.resume(), false);
  assert.equal(lifecycle.canInteract, true);
  assert.equal(lifecycle.pause(), true);
  assert.equal(lifecycle.canInteract, false);
  assert.deepEqual(calls, ['start', 'stop']);
});

test('HostLifecycle never resumes or restarts a completed round behind the host overlay', () => {
  let gameOver = true;
  const calls = [];
  const loop = {
    running: false,
    start() {
      calls.push('start');
      this.running = true;
      return true;
    },
    stop() {
      calls.push('stop');
      this.running = false;
      return false;
    },
  };
  const lifecycle = new HostLifecycle({ loop, isGameOver: () => gameOver });

  assert.equal(lifecycle.canRestart, false);
  assert.equal(lifecycle.resume(), false);
  assert.equal(lifecycle.canRestart, true);
  lifecycle.pause();
  assert.equal(lifecycle.canRestart, false);
  assert.equal(lifecycle.startRestartedRound(), false);

  gameOver = false;
  assert.equal(lifecycle.startRestartedRound(), false);
  lifecycle.resume();
  assert.deepEqual(calls, ['stop', 'start']);
});

test('setTextIfChanged avoids repeated live-region mutations', () => {
  let writes = 0;
  let text = 'SCORE: 0';
  const element = {
    get textContent() {
      return text;
    },
    set textContent(value) {
      writes += 1;
      text = value;
    },
  };

  assert.equal(setTextIfChanged(element, 'SCORE: 0'), false);
  assert.equal(setTextIfChanged(element, 'SCORE: 1'), true);
  assert.equal(setTextIfChanged(element, 'SCORE: 1'), false);
  assert.equal(writes, 1);
});
