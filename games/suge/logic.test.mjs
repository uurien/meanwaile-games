import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_PREY_COUNT,
  COLS,
  INITIAL_SNAKE_LENGTH,
  MIN_TICK_MS,
  PREY_KINDS,
  ROWS,
  START_TICK_MS,
  SnakeEngine,
  TICK_RAMP_SCORE,
  keyToDirection,
  tickIntervalForScore,
} from './logic.js';

function sequenceRng(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('keyToDirection maps arrow keys and WASD, case-insensitively', () => {
  assert.equal(keyToDirection('ArrowUp'), 'up');
  assert.equal(keyToDirection('ArrowDown'), 'down');
  assert.equal(keyToDirection('ArrowLeft'), 'left');
  assert.equal(keyToDirection('ArrowRight'), 'right');
  assert.equal(keyToDirection('w'), 'up');
  assert.equal(keyToDirection('S'), 'down');
  assert.equal(keyToDirection('a'), 'left');
  assert.equal(keyToDirection('D'), 'right');
});

test('keyToDirection returns null for unrelated keys', () => {
  assert.equal(keyToDirection(' '), null);
  assert.equal(keyToDirection('Enter'), null);
  assert.equal(keyToDirection(undefined), null);
});

test('tickIntervalForScore ramps from START_TICK_MS down to MIN_TICK_MS and clamps', () => {
  assert.equal(tickIntervalForScore(0), START_TICK_MS);
  assert.equal(tickIntervalForScore(TICK_RAMP_SCORE), MIN_TICK_MS);
  assert.equal(tickIntervalForScore(TICK_RAMP_SCORE * 2), MIN_TICK_MS);

  const mid = tickIntervalForScore(TICK_RAMP_SCORE / 2);
  assert.ok(mid < START_TICK_MS && mid > MIN_TICK_MS);
});

test('reset() places a long bent snake moving right', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });

  assert.equal(engine.snake.length, INITIAL_SNAKE_LENGTH);
  assert.ok(INITIAL_SNAKE_LENGTH >= 8);
  assert.equal(engine.direction, 'right');
  assert.equal(engine.score, 0);
  assert.equal(engine.gameOver, false);

  for (let i = 1; i < engine.snake.length; i += 1) {
    const current = engine.snake[i - 1];
    const next = engine.snake[i];
    assert.equal(Math.abs(current.x - next.x) + Math.abs(current.y - next.y), 1);
  }
});

test('reset() scatters one collectible of every prey kind on unique empty cells', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });

  assert.equal(ACTIVE_PREY_COUNT, PREY_KINDS.length);
  assert.equal(engine.prey.length, ACTIVE_PREY_COUNT);
  assert.deepEqual(engine.prey.map((animal) => animal.kind).sort(), [...PREY_KINDS].sort());

  const occupied = new Set(engine.snake.map((seg) => `${seg.x},${seg.y}`));
  for (const animal of engine.prey) {
    const key = `${animal.x},${animal.y}`;
    assert.ok(animal.x > 0 && animal.x < COLS - 1);
    assert.ok(animal.y > 0 && animal.y < ROWS - 1);
    assert.ok(!occupied.has(key));
    assert.ok(!occupied.has(key), `${animal.kind} should not overlap the snake`);
    occupied.add(key);
  }

  const subjects = [
    ...engine.snake.map((segment) => ({ ...segment, type: 'snake' })),
    ...engine.prey.map((animal) => ({ ...animal, type: 'prey' })),
  ];
  for (let i = 0; i < subjects.length; i += 1) {
    for (let j = i + 1; j < subjects.length; j += 1) {
      const first = subjects[i];
      const second = subjects[j];
      if (first.type === 'snake' && second.type === 'snake') continue;
      assert.ok(
        Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y)) > 1,
        'new prey artwork should have a one-cell visual gutter',
      );
    }
  }
});

test('reset() is deterministic when supplied the same RNG sequence', () => {
  const values = [0.04, 0.72, 0.18, 0.91, 0.36, 0.63, 0.27, 0.81];
  const first = new SnakeEngine({ rng: sequenceRng(values) });
  const second = new SnakeEngine({ rng: sequenceRng(values) });

  assert.deepEqual(first.prey, second.prey);
});

test('setDirection ignores a direct reversal into the snake itself', () => {
  const engine = new SnakeEngine();
  assert.equal(engine.direction, 'right');
  engine.setDirection('left');
  assert.equal(engine.pendingDirection, 'right');
});

test('setDirection ignores unknown direction strings', () => {
  const engine = new SnakeEngine();
  engine.setDirection('sideways');
  assert.equal(engine.pendingDirection, 'right');
});

test('step() advances the snake by one cell and keeps its length when no prey is eaten', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  engine.prey = [{ x: 0, y: 0, kind: 'mouse' }];
  const head = engine.snake[0];

  engine.step();

  assert.equal(engine.snake.length, INITIAL_SNAKE_LENGTH);
  assert.deepEqual(engine.snake[0], { x: head.x + 1, y: head.y });
});

test('step() grows, scores, and replenishes the eaten prey kind', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  const head = engine.snake[0];
  engine.prey[0] = { x: head.x + 1, y: head.y, kind: 'mouse' };
  const beforeKinds = engine.prey.map((animal) => animal.kind).sort();
  const beforeLength = engine.snake.length;

  engine.step();

  assert.equal(engine.score, 1);
  assert.equal(engine.snake.length, beforeLength + 1);
  assert.deepEqual(engine.snake[0], { x: head.x + 1, y: head.y });
  assert.equal(engine.prey.length, ACTIVE_PREY_COUNT);
  assert.deepEqual(engine.prey.map((animal) => animal.kind).sort(), beforeKinds);

  const occupied = new Set(engine.snake.map((seg) => `${seg.x},${seg.y}`));
  for (const animal of engine.prey) {
    const key = `${animal.x},${animal.y}`;
    assert.ok(!occupied.has(key));
    occupied.add(key);
  }
});

test('step() ends the game when the snake leaves the board', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  engine.snake = [{ x: COLS - 1, y: 0 }, { x: COLS - 2, y: 0 }, { x: COLS - 3, y: 0 }];
  engine.direction = 'right';
  engine.pendingDirection = 'right';
  engine.prey = [{ x: 0, y: ROWS - 1, kind: 'worm' }];

  engine.step();

  assert.equal(engine.gameOver, true);
});

test('step() ends the game on the inner frame before the drawn head is clipped', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  engine.snake = [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }];
  engine.direction = 'left';
  engine.pendingDirection = 'left';
  engine.prey = [{ x: COLS - 2, y: ROWS - 2, kind: 'mouse' }];

  engine.step();

  assert.equal(engine.gameOver, true);
  assert.deepEqual(engine.snake[0], { x: 1, y: 5 });
});

test('step() ends the game when the snake bites its own body', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  // A closed 4-cell loop: moving right drives the head into its own neck segment.
  engine.snake = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];
  engine.direction = 'right';
  engine.pendingDirection = 'right';
  engine.prey = [{ x: 0, y: 0, kind: 'frog' }];

  engine.step();

  assert.equal(engine.gameOver, true);
});

test('step() allows moving into the current tail cell, since it vacates that step', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  engine.snake = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 4 },
    { x: 5, y: 4 },
  ];
  engine.direction = 'up';
  engine.pendingDirection = 'up';
  engine.prey = [{ x: 0, y: 0, kind: 'frog' }];

  engine.step();

  assert.equal(engine.gameOver, false);
  assert.deepEqual(engine.snake, [
    { x: 5, y: 4 },
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 4 },
  ]);
});

test('step() is a no-op once the game is over', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  engine.gameOver = true;
  const snapshot = JSON.stringify(engine.snake);

  engine.step();

  assert.equal(JSON.stringify(engine.snake), snapshot);
});

test('spawnPrey falls back to any exact empty cell when no guttered cell remains', () => {
  const engine = new SnakeEngine({ rng: sequenceRng([0]) });
  const onlyEmpty = { x: 5, y: 5 };
  engine.snake = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (x !== onlyEmpty.x || y !== onlyEmpty.y) engine.snake.push({ x, y });
    }
  }
  engine.prey = [];

  assert.deepEqual(engine.spawnPrey('worm'), { ...onlyEmpty, kind: 'worm' });
});

test('reset() after a game over restores a fresh playable state', () => {
  const engine = new SnakeEngine();
  engine.gameOver = true;
  engine.score = 12;

  engine.reset();

  assert.equal(engine.gameOver, false);
  assert.equal(engine.score, 0);
  assert.equal(engine.snake.length, INITIAL_SNAKE_LENGTH);
  assert.equal(engine.prey.length, ACTIVE_PREY_COUNT);
});
