export class FrameLoop {
  constructor({ requestFrame, cancelFrame, onFrame }) {
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.onFrame = onFrame;
    this.frameId = null;
    this.lastFrameAt = null;
    this.boundFrame = (now) => this.frame(now);
  }

  get running() {
    return this.frameId !== null;
  }

  start() {
    if (this.running) return false;
    this.lastFrameAt = null;
    this.frameId = this.requestFrame(this.boundFrame);
    return true;
  }

  stop() {
    if (!this.running) return false;
    this.cancelFrame(this.frameId);
    this.frameId = null;
    this.lastFrameAt = null;
    return true;
  }

  frame(now) {
    if (!this.running) return;

    this.frameId = null;
    const deltaMs = this.lastFrameAt === null ? 0 : Math.max(0, now - this.lastFrameAt);
    this.lastFrameAt = now;
    if (this.onFrame(deltaMs, now) === false) {
      this.lastFrameAt = null;
      return;
    }
    this.frameId = this.requestFrame(this.boundFrame);
  }
}

export class HostLifecycle {
  constructor({ loop, isGameOver }) {
    this.loop = loop;
    this.isGameOver = isGameOver;
    this.paused = true;
  }

  get canInteract() {
    return !this.paused && this.loop.running;
  }

  get canRestart() {
    return !this.paused;
  }

  pause() {
    if (this.paused) return false;
    this.paused = true;
    this.loop.stop();
    return true;
  }

  resume() {
    if (!this.paused) return false;
    this.paused = false;
    if (this.isGameOver()) return false;
    return this.loop.start();
  }

  startRestartedRound() {
    if (this.paused || this.isGameOver()) return false;
    return this.loop.start();
  }
}

export function setTextIfChanged(element, value) {
  if (element.textContent === value) return false;
  element.textContent = value;
  return true;
}
