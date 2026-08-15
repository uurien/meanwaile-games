import { WORDS } from './words.js';

export const WALL_ROWS = 3;
export const CHAIN_SEGMENTS = 5;
export const MAX_HEALTH = 5;
export const WPM_WINDOW_MS = 60_000;

export const DEFAULT_CONFIG = Object.freeze({
  columns: 20,
  wallY: 289,
  wallRowHeight: 21,
  blockSize: 20,
  boardLeft: 10,
  columnWidth: 21,
  spawnTopY: 61,
  characterStep: 14,
  initialFallSpeed: 14,
  fallAcceleration: 0.14,
  spawnIntervalMs: 1_450,
  duplicateChance: 0.24,
  destructionStepMs: 55,
  maxDeltaMs: 100,
  maxInputLength: 22,
});

export function validateWords(words) {
  if (!Array.isArray(words) || words.length < 100) {
    throw new Error('The word database must contain at least 100 entries');
  }
  const seen = new Set();
  for (const word of words) {
    if (typeof word !== 'string' || word.length === 0) {
      throw new Error('The word database cannot contain an empty entry');
    }
    if (/\s/u.test(word)) {
      throw new Error(`The word database cannot contain whitespace: ${word}`);
    }
    if (word !== word.toLowerCase()) {
      throw new Error(`Every word must be lowercase: ${word}`);
    }
    if (seen.has(word)) throw new Error(`Duplicate word: ${word}`);
    seen.add(word);
  }
  return true;
}

validateWords(WORDS);

export function getWpm(destructionTimes, nowMs) {
  const windowStart = nowMs - WPM_WINDOW_MS;
  return destructionTimes.filter((time) => time >= windowStart && time <= nowMs).length;
}

export function firstVisibleCharacterIndex(word, config = DEFAULT_CONFIG) {
  const rawIndex = Math.ceil(
    word.text.length - 1 - (word.y - config.spawnTopY) / config.characterStep,
  );
  return Math.max(0, Math.min(word.text.length, rawIndex));
}

function randomIndex(length, rng) {
  return Math.min(Math.floor(rng() * length), length - 1);
}

function makeBlocks(columns) {
  return Array.from({ length: WALL_ROWS }, () => new Array(columns).fill(true));
}

export class TypewallEngine {
  constructor(options = {}) {
    const { rng = Math.random, words = WORDS, ...overrides } = options;
    validateWords(words);
    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...overrides });
    this.rng = rng;
    this.words = words;
    this.nextWordId = 1;
    this.nextParticleId = 1;
    this.reset();
  }

  get wallY() {
    return this.config.wallY;
  }

  get groundY() {
    return this.wallY + WALL_ROWS * this.config.wallRowHeight;
  }

  reset() {
    this.activeWords = [];
    this.destroyingWords = [];
    this.particles = [];
    this.blocks = makeBlocks(this.config.columns);
    this.input = '';
    this.score = 0;
    this.chainMultiplier = 1;
    this.chainProgress = 0;
    this.health = MAX_HEALTH;
    this.gameOver = false;
    this.gameOverAtMs = null;
    this.elapsedMs = 0;
    this.timeSinceSpawnMs = 0;
    this.destroyedWordTimes = [];
  }

  addWord(text, { column = 0, y } = {}) {
    const normalized = String(text).toLowerCase();
    const word = {
      id: this.nextWordId++,
      text: normalized,
      column: Math.max(0, Math.min(this.config.columns - 1, column)),
      y: y ?? this.config.spawnTopY,
    };
    this.activeWords.push(word);
    return word;
  }

  getWpm(nowMs = this.elapsedMs) {
    return getWpm(this.destroyedWordTimes, this.gameOverAtMs ?? nowMs);
  }

  handleKey(key, nowMs = this.elapsedMs) {
    if (this.gameOver) {
      if (key === 'Enter') this.reset();
      return true;
    }
    if (key === 'Backspace') return true;
    if (key === 'Escape') {
      this.input = '';
      return true;
    }
    if (key === 'Enter') {
      if (this.input.length > 0) this.submitInput(nowMs);
      return true;
    }
    if (/^[a-z0-9]$/iu.test(key) && this.input.length < this.config.maxInputLength) {
      this.input += key.toLowerCase();
      return true;
    }
    return false;
  }

  submitInput(nowMs) {
    const submitted = this.input.toLowerCase();
    const matches = this.activeWords.filter((word) => word.text === submitted);
    const multiplier = this.chainMultiplier;

    if (matches.length > 0) {
      const matchIds = new Set(matches.map((word) => word.id));
      this.activeWords = this.activeWords.filter((word) => !matchIds.has(word.id));
      this.score += submitted.length * matches.length * multiplier;
      for (const word of matches) {
        this.destroyedWordTimes.push(nowMs);
        this.destroyingWords.push({
          ...word,
          startedAtMs: nowMs,
          stepAccumulatorMs: 0,
          nextCharacterIndex: word.text.length - 1,
        });
      }
      this.chainProgress += 1;
      if (this.chainProgress === CHAIN_SEGMENTS) {
        this.chainMultiplier += 1;
        this.chainProgress = 0;
      }
    } else {
      this.score -= submitted.length * multiplier;
      this.chainMultiplier = 1;
      this.chainProgress = 0;
    }
    this.input = '';
  }

  update(
    dtMs,
    nowMs = this.elapsedMs + Math.max(0, Math.min(dtMs, this.config.maxDeltaMs)),
  ) {
    const dt = Math.max(0, Math.min(dtMs, this.config.maxDeltaMs));
    if (dt === 0) return;

    this.updateParticles(dt);
    this.updateDestructions(dt);
    if (this.gameOver) return;

    this.elapsedMs += dt;
    const elapsedSeconds = this.elapsedMs / 1_000;
    const fallSpeed =
      this.config.initialFallSpeed + this.config.fallAcceleration * elapsedSeconds;
    const distance = fallSpeed * (dt / 1_000);

    const survivors = [];
    for (const word of this.activeWords) {
      word.y += distance;
      if (this.resolveWallCollision(word, nowMs)) {
        if (this.gameOver) break;
      } else survivors.push(word);
    }
    this.activeWords = survivors;

    if (this.gameOver) return;
    this.timeSinceSpawnMs += dt;
    while (this.timeSinceSpawnMs >= this.config.spawnIntervalMs) {
      this.timeSinceSpawnMs -= this.config.spawnIntervalMs;
      this.spawnWord();
      if (!Number.isFinite(this.config.spawnIntervalMs)) break;
    }
  }

  resolveWallCollision(word, nowMs = this.elapsedMs) {
    const rowIndex = this.blocks.findIndex((row) => row[word.column]);
    const collisionY = rowIndex >= 0
      ? this.wallY + rowIndex * this.config.wallRowHeight
      : this.groundY;
    if (word.y < collisionY) return false;

    if (rowIndex >= 0) {
      this.blocks[rowIndex][word.column] = false;
      this.createBlockParticles(word.column, rowIndex);
      return true;
    }
    this.health = Math.max(0, this.health - 1);
    this.createBreachParticles(word.column);
    if (this.health === 0) {
      this.gameOver = true;
      this.gameOverAtMs = nowMs;
    }
    return true;
  }

  spawnWord() {
    const columns = Array.from({ length: this.config.columns }, (_, index) => index);
    const offset = randomIndex(columns.length, this.rng);
    const candidates = columns.slice(offset).concat(columns.slice(0, offset));
    const duplicatePool = this.activeWords.map((word) => word.text);
    const shouldDuplicate = duplicatePool.length > 0 && this.rng() < this.config.duplicateChance;
    const text = shouldDuplicate
      ? duplicatePool[randomIndex(duplicatePool.length, this.rng)]
      : this.words[randomIndex(this.words.length, this.rng)];
    const y = this.config.spawnTopY;
    const column = candidates.find((candidate) => this.canSpawnInColumn(candidate, y, text.length));
    if (column === undefined) return null;
    return this.addWord(text, { column, y });
  }

  canSpawnInColumn(column, y, textLength) {
    const newTop = y - (textLength - 1) * this.config.characterStep;
    const newBottom = y;
    return this.activeWords.every((word) => {
      if (word.column !== column) return true;
      const top = word.y - (word.text.length - 1) * this.config.characterStep;
      const bottom = word.y;
      return newBottom + 14 < top || newTop > bottom + 14;
    });
  }

  updateDestructions(dt) {
    const survivors = [];
    for (const animation of this.destroyingWords) {
      animation.stepAccumulatorMs += dt;
      while (
        animation.nextCharacterIndex >= 0 &&
        animation.stepAccumulatorMs >= this.config.destructionStepMs
      ) {
        animation.stepAccumulatorMs -= this.config.destructionStepMs;
        this.createLetterParticles(animation, animation.nextCharacterIndex);
        animation.nextCharacterIndex -= 1;
      }
      if (animation.nextCharacterIndex >= 0) survivors.push(animation);
    }
    this.destroyingWords = survivors;
  }

  particle(kind, x, y, vx, vy, lifeMs, size) {
    this.particles.push({
      id: this.nextParticleId++, kind, x, y, vx, vy, lifeMs,
      maxLifeMs: lifeMs, alpha: 1, size,
    });
  }

  createLetterParticles(animation, characterIndex) {
    const x = this.config.boardLeft + animation.column * this.config.columnWidth + this.config.columnWidth / 2;
    const y = animation.y - (animation.text.length - 1 - characterIndex) * this.config.characterStep;
    for (let index = 0; index < 7; index += 1) {
      const drift = (this.rng() - 0.5) * 15;
      this.particle('letter', x + (this.rng() - 0.5) * 5, y, drift, -16 - this.rng() * 18, 380 + this.rng() * 180, 1 + Math.floor(this.rng() * 2));
    }
  }

  createBlockParticles(column, row) {
    const x = this.config.boardLeft + column * this.config.columnWidth + this.config.columnWidth / 2;
    const y = this.wallY + row * this.config.wallRowHeight + 5;
    for (let index = 0; index < 24; index += 1) {
      this.particle('block', x + (this.rng() - 0.5) * 24, y, (this.rng() - 0.5) * 24, -20 - this.rng() * 30, 650 + this.rng() * 240, 1 + Math.floor(this.rng() * 3));
    }
  }

  createBreachParticles(column) {
    const x = this.config.boardLeft + column * this.config.columnWidth + this.config.columnWidth / 2;
    for (let index = 0; index < 9; index += 1) {
      this.particle('breach', x, this.groundY, (this.rng() - 0.5) * 18, -12 - this.rng() * 18, 500, 2);
    }
  }

  updateParticles(dt) {
    const seconds = dt / 1_000;
    for (const particle of this.particles) {
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.lifeMs -= dt;
      particle.alpha = Math.max(0, particle.lifeMs / particle.maxLifeMs);
    }
    this.particles = this.particles.filter((particle) => particle.lifeMs > 0);
  }
}
