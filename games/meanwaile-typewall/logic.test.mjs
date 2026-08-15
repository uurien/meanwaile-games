import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TypewallEngine,
  firstVisibleCharacterIndex,
  getWpm,
  validateWords,
} from './logic.js';
import { WORDS } from './words.js';

const TEST_CONFIG = Object.freeze({
  columns: 4,
  wallY: 100,
  initialFallSpeed: 100,
  fallAcceleration: 0,
  spawnIntervalMs: Number.POSITIVE_INFINITY,
  duplicateChance: 0,
  destructionStepMs: 50,
  maxDeltaMs: 100,
});

function createEngine(overrides = {}) {
  return new TypewallEngine({
    ...TEST_CONFIG,
    ...overrides,
    rng: overrides.rng ?? (() => 0.5),
  });
}

function typeText(engine, text, nowMs = 0) {
  for (const character of text) engine.handleKey(character, nowMs);
}

function submit(engine, text, nowMs = 0) {
  typeText(engine, text, nowMs);
  engine.handleKey('Enter', nowMs);
}

function addWord(engine, text, column = 0, y = 0) {
  return engine.addWord(text, { column, y });
}

function intactBlocksInColumn(engine, column) {
  return engine.blocks.reduce(
    (total, row) => total + Number(row[column]),
    0,
  );
}

function removeColumn(engine, column) {
  for (const row of engine.blocks) row[column] = false;
}

function collideAtWall(engine, text, column = 0) {
  // A word's y coordinate is its leading (bottom) edge. Ten milliseconds at
  // 100 px/s carries this word across the logical wall at y=100.
  addWord(engine, text, column, engine.wallY - 0.5);
  engine.update(10);
}

test('docker x3 at CHAIN x14 adds 252 and starts every destruction together', () => {
  const engine = createEngine();
  engine.chainMultiplier = 14;
  addWord(engine, 'docker', 0, 20);
  addWord(engine, 'docker', 1, 30);
  addWord(engine, 'docker', 2, 40);

  submit(engine, 'docker', 1_000);

  assert.equal(engine.score, 252);
  assert.equal(engine.activeWords.length, 0);
  assert.equal(engine.destroyingWords.length, 3);
  assert.deepEqual(
    new Set(engine.destroyingWords.map((animation) => animation.startedAtMs)),
    new Set([1_000]),
  );
});

test('dockerr at CHAIN x14 subtracts 98, clears input, and resets CHAIN', () => {
  const engine = createEngine();
  engine.chainMultiplier = 14;
  engine.chainProgress = 4;

  submit(engine, 'dockerr');

  assert.equal(engine.score, -98);
  assert.equal(engine.chainMultiplier, 1);
  assert.equal(engine.chainProgress, 0);
  assert.equal(engine.input, '');
});

test('a dictionary word that has no active instance is still a miss', () => {
  const engine = createEngine();
  assert.ok(WORDS.includes('docker'));

  submit(engine, 'docker');

  assert.equal(engine.score, -6);
  assert.equal(engine.chainMultiplier, 1);
  assert.equal(engine.chainProgress, 0);
  assert.equal(engine.destroyingWords.length, 0);
});

test('matching is case-insensitive and input is normalized to lowercase', () => {
  const engine = createEngine();
  addWord(engine, 'docker', 0, 20);

  typeText(engine, 'DOCKER');
  assert.equal(engine.input, 'docker');
  engine.handleKey('Enter', 100);

  assert.equal(engine.score, 6);
  assert.equal(engine.input, '');
  assert.equal(engine.activeWords.length, 0);
  assert.equal(engine.destroyingWords.length, 1);
  assert.equal(engine.destroyingWords[0].text, 'docker');
});

test('Backspace is consumed without changing the typed text', () => {
  const engine = createEngine();
  typeText(engine, 'dock');

  engine.handleKey('Backspace');

  assert.equal(engine.input, 'dock');
});

test('Escape clears input without changing score or CHAIN', () => {
  const engine = createEngine();
  engine.score = 37;
  engine.chainMultiplier = 4;
  engine.chainProgress = 3;
  typeText(engine, 'dock');

  engine.handleKey('Escape');

  assert.equal(engine.input, '');
  assert.equal(engine.score, 37);
  assert.equal(engine.chainMultiplier, 4);
  assert.equal(engine.chainProgress, 3);
});

test('an empty Enter is a no-op and does not reset an existing CHAIN', () => {
  const engine = createEngine();
  engine.score = 37;
  engine.chainMultiplier = 4;
  engine.chainProgress = 3;

  engine.handleKey('Enter', 100);

  assert.equal(engine.input, '');
  assert.equal(engine.score, 37);
  assert.equal(engine.chainMultiplier, 4);
  assert.equal(engine.chainProgress, 3);
  assert.equal(engine.destroyedWordTimes.length, 0);
});

test('five correct Enters advance CHAIN from x1 to x2 and empty its five segments', () => {
  const engine = createEngine();
  const words = ['ls', 'pwd', 'cat', 'grep', 'docker'];
  let expectedScore = 0;

  words.forEach((word, index) => {
    addWord(engine, word, index % TEST_CONFIG.columns, 10 + index);
    submit(engine, word, index * 100);
    expectedScore += word.length;
  });

  // The fifth action still scores at x1. Only the next submission uses x2.
  assert.equal(engine.score, expectedScore);
  assert.equal(engine.chainMultiplier, 2);
  assert.equal(engine.chainProgress, 0);

  addWord(engine, 'echo', 0, 20);
  submit(engine, 'echo', 600);
  assert.equal(engine.score, expectedScore + 8);
  assert.equal(engine.chainMultiplier, 2);
  assert.equal(engine.chainProgress, 1);
});

test('destroying duplicate matches fills only one CHAIN segment per Enter', () => {
  const engine = createEngine();
  addWord(engine, 'docker', 0, 20);
  addWord(engine, 'docker', 1, 30);
  addWord(engine, 'docker', 2, 40);

  submit(engine, 'docker');

  assert.equal(engine.destroyingWords.length, 3);
  assert.equal(engine.chainProgress, 1);
});

test('the wall always starts as exactly three complete rows of equal blocks', () => {
  const engine = createEngine();

  assert.equal(engine.blocks.length, 3);
  assert.ok(engine.blocks.every((row) => row.length === TEST_CONFIG.columns));
  assert.ok(engine.blocks.every((row) => row.every((block) => block === true)));
});

test('one word impact removes exactly one block and the word from simulation', () => {
  const engine = createEngine();

  collideAtWall(engine, 'ls', 0);

  assert.equal(intactBlocksInColumn(engine, 0), 2);
  assert.equal(engine.activeWords.length, 0);
  assert.equal(engine.health, 5);
});

test('successive impacts remove the first remaining block, one at a time', () => {
  const engine = createEngine();

  collideAtWall(engine, 'ls', 0);
  collideAtWall(engine, 'pwd', 0);

  assert.deepEqual(
    engine.blocks.map((row) => row[0]),
    [false, false, true],
  );
  assert.equal(engine.health, 5);
});

test('a word crossing a full hole costs exactly one health regardless of length', () => {
  const engine = createEngine();
  removeColumn(engine, 0);

  collideAtWall(engine, 'kubernetes', 0);

  assert.equal(engine.health, 4);
  assert.equal(engine.activeWords.length, 0);
});

test('health reaching zero produces game over', () => {
  const engine = createEngine();
  removeColumn(engine, 0);
  engine.health = 1;

  collideAtWall(engine, 'ls', 0);

  assert.equal(engine.health, 0);
  assert.equal(engine.gameOver, true);
});

test('Enter restarts a game over with fresh health, wall, score, and CHAIN', () => {
  const engine = createEngine();
  removeColumn(engine, 0);
  engine.health = 1;
  engine.score = 123;
  engine.chainMultiplier = 8;
  engine.chainProgress = 4;
  collideAtWall(engine, 'ls', 0);
  assert.equal(engine.gameOver, true);

  engine.handleKey('Enter', 500);

  assert.equal(engine.gameOver, false);
  assert.equal(engine.health, 5);
  assert.equal(engine.score, 0);
  assert.equal(engine.chainMultiplier, 1);
  assert.equal(engine.chainProgress, 0);
  assert.equal(engine.blocks.flat().filter(Boolean).length, 3 * TEST_CONFIG.columns);
});

test('a word enters destruction outside simulation and can no longer hit the wall', () => {
  const engine = createEngine();
  addWord(engine, 'docker', 0, engine.wallY - 0.5);

  submit(engine, 'docker');
  assert.equal(engine.activeWords.length, 0);
  assert.equal(engine.destroyingWords.length, 1);
  engine.update(500);

  assert.equal(intactBlocksInColumn(engine, 0), 3);
  assert.equal(engine.health, 5);
});

test('destruction removes the last visible character first at the configured cadence', () => {
  const engine = createEngine({ destructionStepMs: 50 });
  addWord(engine, 'dock', 0, 20);
  submit(engine, 'dock');

  assert.equal(engine.destroyingWords[0].nextCharacterIndex, 3);
  engine.update(49);
  assert.equal(engine.destroyingWords[0].nextCharacterIndex, 3);
  engine.update(1);
  assert.equal(engine.destroyingWords[0].nextCharacterIndex, 2);
  assert.ok(engine.particles.some((particle) => particle.kind === 'letter'));
});

test('a broken block creates purely visual fragments that rise and fade', () => {
  const engine = createEngine();
  collideAtWall(engine, 'ls', 0);
  const fragments = engine.particles.filter((particle) => particle.kind === 'block');

  assert.ok(fragments.length > 0);
  assert.ok(fragments.every((particle) => particle.vy < 0));
  const before = fragments.map(({ y, alpha }) => ({ y, alpha }));
  engine.update(20);
  const after = engine.particles.filter((particle) => particle.kind === 'block');
  assert.equal(after.length, before.length);
  after.forEach((particle, index) => {
    assert.ok(particle.y < before[index].y);
    assert.ok(particle.alpha < before[index].alpha);
  });
});

test('duplicate instances count individually as destroyed words per minute', () => {
  const engine = createEngine();
  addWord(engine, 'docker', 0, 20);
  addWord(engine, 'docker', 1, 30);
  addWord(engine, 'docker', 2, 40);

  submit(engine, 'docker', 1_000);

  assert.equal(engine.getWpm(1_000), 3);
  assert.equal(getWpm(engine.destroyedWordTimes, 1_000), 3);
  assert.equal(engine.getWpm(61_001), 0);
});

test('WPM uses a rolling 60-second instance window, not character count', () => {
  const destructionTimes = [1_000, 10_000, 60_000, 60_001];

  assert.equal(getWpm(destructionTimes, 60_001), 4);
  assert.equal(getWpm(destructionTimes, 61_001), 3);
  assert.equal(getWpm(destructionTimes, 120_002), 0);
});

test('the word database contains the 180 valid, lowercase, unique terms', () => {
  assert.equal(validateWords(WORDS), true);
  assert.equal(WORDS.length, 180);
  assert.ok(WORDS.length >= 100);
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.ok(WORDS.every((word) => word.length > 0));
  assert.ok(WORDS.every((word) => !/\s/u.test(word)));
  assert.ok(WORDS.every((word) => word === word.toLowerCase()));
});

test('word validation rejects every malformed database invariant', () => {
  const duplicate = [...WORDS];
  duplicate[1] = duplicate[0];
  const uppercase = [...WORDS];
  uppercase[0] = 'LS';
  const spaced = [...WORDS];
  spaced[0] = 'two words';
  const empty = [...WORDS];
  empty[0] = '';

  assert.throws(() => validateWords(WORDS.slice(0, 99)), /at least 100/i);
  assert.throws(() => validateWords(duplicate), /duplicate/i);
  assert.throws(() => validateWords(uppercase), /lowercase/i);
  assert.throws(() => validateWords(spaced), /space|whitespace/i);
  assert.throws(() => validateWords(empty), /empty/i);
});

test('duplicate spawning can reuse an active word and never stacks it in the same column', () => {
  const engine = createEngine({
    columns: 2,
    duplicateChance: 1,
    rng: () => 0,
  });
  addWord(
    engine,
    'docker',
    0,
    engine.config.spawnTopY + ('docker'.length - 1) * engine.config.characterStep,
  );

  const spawned = engine.spawnWord();

  assert.equal(spawned.text, 'docker');
  assert.equal(spawned.column, 1);
});

test('an abnormally large delta is clamped before movement and difficulty advance', () => {
  const engine = createEngine({ maxDeltaMs: 100 });
  const word = addWord(engine, 'ls', 0, 0);

  engine.update(10_000);

  assert.equal(engine.elapsedMs, 100);
  assert.ok(word.y < 11);
});

test('a falling word enters bottom letter first and reveals upper letters by movement', () => {
  const engine = createEngine({
    spawnTopY: 20,
    characterStep: 10,
    initialFallSpeed: 100,
    maxDeltaMs: 100,
  });
  const word = engine.addWord('dock');

  assert.equal(word.y, 20);
  assert.equal(firstVisibleCharacterIndex(word, engine.config), 3);
  assert.equal(word.text.slice(firstVisibleCharacterIndex(word, engine.config)), 'k');

  engine.update(99);
  assert.equal(firstVisibleCharacterIndex(word, engine.config), 3);
  engine.update(1);
  assert.equal(firstVisibleCharacterIndex(word, engine.config), 2);
  assert.equal(word.text.slice(firstVisibleCharacterIndex(word, engine.config)), 'ck');
});
