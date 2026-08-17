export const COLS = 21;
export const ROWS = 20;

export const PREY_KINDS = [
  'mouse',
  'frog',
  'lizard',
  'chick',
  'beetle',
  'snail',
  'fish',
  'worm',
];

export const ACTIVE_PREY_COUNT = PREY_KINDS.length;
export const MIN_PREY_SPAWN_MS = 0;
export const MAX_PREY_SPAWN_MS = 5_000;

const INITIAL_SNAKE = [
  { x: 14, y: 8 },
  { x: 13, y: 8 },
  { x: 12, y: 8 },
];

export const INITIAL_SNAKE_LENGTH = INITIAL_SNAKE.length;
export const START_TICK_MS = 155;
export const MIN_TICK_MS = 82;
export const TICK_RAMP_SCORE = 30;

const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const KEY_DIRECTIONS = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

export function keyToDirection(key) {
  if (typeof key !== 'string') return null;
  return KEY_DIRECTIONS[key.toLowerCase()] ?? null;
}

export function tickIntervalForScore(score) {
  const progress = Math.min(1, Math.max(0, score) / TICK_RAMP_SCORE);
  return START_TICK_MS - progress * (START_TICK_MS - MIN_TICK_MS);
}

function randomIndex(rng, length) {
  const value = Math.max(0, Math.min(0.999999999, rng()));
  return Math.floor(value * length);
}

function randomPreySpawnDelay(rng) {
  const value = Math.max(0, Math.min(0.999999999, rng()));
  return MIN_PREY_SPAWN_MS + value * (MAX_PREY_SPAWN_MS - MIN_PREY_SPAWN_MS);
}

export class SnakeEngine {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.snake = INITIAL_SNAKE.map((segment) => ({ ...segment }));
    this.direction = 'right';
    this.pendingDirection = 'right';
    this.score = 0;
    this.gameOver = false;
    this.collision = null;
    this.prey = [];
    this.spawnRandomPrey();
    this.nextPreySpawnInMs = randomPreySpawnDelay(this.rng);
  }

  setDirection(direction) {
    if (!VECTORS[direction]) return;
    if (OPPOSITE[direction] === this.direction) return;
    this.pendingDirection = direction;
  }

  emptyCells(gutter = 1) {
    const subjects = [...this.snake, ...this.prey];

    const result = [];
    // Keep collectibles away from the wall so their artwork remains fully
    // inside the hand-drawn frame and every spawn is reachable without an
    // immediately fatal move.
    for (let y = 1; y < ROWS - 1; y += 1) {
      for (let x = 1; x < COLS - 1; x += 1) {
        const tooClose = subjects.some((subject) => (
          Math.max(Math.abs(subject.x - x), Math.abs(subject.y - y)) <= gutter
        ));
        if (!tooClose) result.push({ x, y });
      }
    }
    return result;
  }

  spawnPrey(kind) {
    if (!PREY_KINDS.includes(kind)) return null;
    let empty = this.emptyCells(1);
    if (empty.length === 0) empty = this.emptyCells(0);
    if (empty.length === 0) return null;

    const cell = empty[randomIndex(this.rng, empty.length)];
    const animal = { x: cell.x, y: cell.y, kind };
    this.prey.push(animal);
    return animal;
  }

  spawnRandomPrey() {
    if (this.prey.length >= ACTIVE_PREY_COUNT) return null;
    const activeKinds = new Set(this.prey.map((animal) => animal.kind));
    const missingKinds = PREY_KINDS.filter((kind) => !activeKinds.has(kind));
    if (missingKinds.length === 0) return null;
    return this.spawnPrey(missingKinds[randomIndex(this.rng, missingKinds.length)]);
  }

  advancePreySpawns(deltaMs) {
    if (this.gameOver || !Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
    if (this.prey.length >= ACTIVE_PREY_COUNT) return 0;

    this.nextPreySpawnInMs -= deltaMs;
    if (this.nextPreySpawnInMs > 0) return 0;

    const spawned = this.spawnRandomPrey() ? 1 : 0;
    this.nextPreySpawnInMs = randomPreySpawnDelay(this.rng);
    return spawned;
  }

  step() {
    if (this.gameOver) return;

    this.direction = this.pendingDirection;
    const delta = VECTORS[this.direction];
    const head = this.snake[0];
    const next = { x: head.x + delta.x, y: head.y + delta.y };

    if (next.x <= 0 || next.x >= COLS - 1 || next.y <= 0 || next.y >= ROWS - 1) {
      this.finishCollision('wall', next);
      return;
    }

    const preyIndex = this.prey.findIndex((animal) => (
      animal.x === next.x && animal.y === next.y
    ));
    const willEat = preyIndex !== -1;

    // The tail vacates this step unless prey is eaten, so entering that
    // single cell is safe on a normal move.
    const collisionBody = willEat ? this.snake : this.snake.slice(0, -1);
    if (collisionBody.some((segment) => segment.x === next.x && segment.y === next.y)) {
      this.finishCollision('self', next);
      return;
    }

    this.snake.unshift(next);

    if (willEat) {
      this.prey.splice(preyIndex, 1);
      this.score += 1;
    } else {
      this.snake.pop();
    }
  }

  finishCollision(type, next) {
    const collision = { type, at: { ...next } };
    if (type === 'wall') {
      const head = this.snake[0];
      collision.impact = {
        x: (head.x + next.x + 1) / 2,
        y: (head.y + next.y + 1) / 2,
      };
    } else {
      const head = this.snake[0];
      this.snake[0] = {
        x: (head.x + next.x) / 2,
        y: (head.y + next.y) / 2,
      };
    }
    this.collision = collision;
    this.gameOver = true;
  }
}
