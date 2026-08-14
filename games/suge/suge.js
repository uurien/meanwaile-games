import { COLS, ROWS, SnakeEngine, keyToDirection, tickIntervalForScore } from './logic.js';
import {
  contentBoxSize,
  createDecorations,
  drawScene,
  fitBoardToStage,
} from './render.js';
import { FrameLoop, HostLifecycle, setTextIfChanged } from './runtime.js';

const RECORD_KEY = 'suge-record';
const DECORATION_COUNT = 27;
const SWIPE_THRESHOLD_PX = 16;

const stage = document.getElementById('stage');
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const recordEl = document.getElementById('record-score');
const restartButton = document.getElementById('restart');

const preyAtlas = new Image();
preyAtlas.src = 'assets/prey-atlas.png';
preyAtlas.addEventListener('load', () => render());

function getRecord() {
  const raw = localStorage.getItem(RECORD_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function setRecord(value) {
  localStorage.setItem(RECORD_KEY, String(value));
}

function copySnake(snake) {
  return snake.map((segment) => ({ ...segment }));
}

let record = getRecord();
const engine = new SnakeEngine();
let previousSnake = copySnake(engine.snake);
let decorations = createDecorations(DECORATION_COUNT, Math.random, COLS, ROWS);
let boardWidth = 1;
let boardHeight = 1;
let cellSize = 1;
let accumulatorMs = 0;
let animationMs = 0;

function readPreviewState() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') !== '1') return null;

  const score = params.has('score') ? Number(params.get('score')) : 57;
  const high = params.has('high') ? Number(params.get('high')) : 200;
  return {
    score: Number.isFinite(score) && score >= 0 ? Math.floor(score) : 57,
    high: Number.isFinite(high) && high >= 0 ? Math.floor(high) : 200,
  };
}

const previewState = readPreviewState();
if (previewState) {
  engine.score = previewState.score;
  record = previewState.high;
}

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const available = contentBoxSize(
    stage.clientWidth,
    stage.clientHeight,
    getComputedStyle(stage),
  );
  const fitted = fitBoardToStage(available.width, available.height, COLS / ROWS);
  cellSize = Math.max(0.1, fitted.width / COLS);
  boardWidth = cellSize * COLS;
  boardHeight = cellSize * ROWS;

  canvas.style.width = `${boardWidth}px`;
  canvas.style.height = `${boardHeight}px`;
  canvas.width = Math.max(1, Math.round(boardWidth * dpr));
  canvas.height = Math.max(1, Math.round(boardHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function render() {
  setTextIfChanged(scoreEl, `SCORE: ${engine.score}`);
  setTextIfChanged(highEl, `HIGH: ${record}`);
  const interval = tickIntervalForScore(engine.score);
  drawScene(ctx, {
    width: boardWidth,
    height: boardHeight,
    cols: COLS,
    rows: ROWS,
    cellSize,
    snake: engine.snake,
    previousSnake,
    prey: engine.prey,
    direction: engine.direction,
    decorations,
    preyAtlas,
    interpolation: Math.min(1, accumulatorMs / interval),
    animationMs,
  });
}

function finishRound() {
  loop.stop();
  record = Math.max(engine.score, record);
  setRecord(record);
  finalScoreEl.textContent = String(engine.score);
  recordEl.textContent = String(record);
  gameOverEl.hidden = false;
  render();
  restartButton.focus({ preventScroll: true });
}

function restart() {
  if (!engine.gameOver || !lifecycle.canRestart) return;
  gameOverEl.hidden = true;
  engine.reset();
  previousSnake = copySnake(engine.snake);
  decorations = createDecorations(DECORATION_COUNT, Math.random, COLS, ROWS);
  accumulatorMs = 0;
  render();
  lifecycle.startRestartedRound();
}

function advance(deltaMs) {
  animationMs += deltaMs;
  accumulatorMs += Math.min(deltaMs, 100);
  let interval = tickIntervalForScore(engine.score);

  while (accumulatorMs >= interval) {
    previousSnake = copySnake(engine.snake);
    engine.step();
    accumulatorMs -= interval;
    if (engine.gameOver) break;
    interval = tickIntervalForScore(engine.score);
  }

  if (engine.gameOver) {
    finishRound();
    return false;
  }
  render();
  return true;
}

const loop = new FrameLoop({
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  onFrame: advance,
});
const lifecycle = new HostLifecycle({ loop, isGameOver: () => engine.gameOver });

window.addEventListener('message', (event) => {
  if (event.data?.type === 'game:pause') {
    touchStart = null;
    lifecycle.pause();
  }
  if (event.data?.type === 'game:resume') lifecycle.resume();
});

function handleDirectionInput(direction) {
  if (engine.gameOver || !lifecycle.canInteract) return;
  engine.setDirection(direction);
}

window.addEventListener('keydown', (event) => {
  const direction = keyToDirection(event.key);
  if (!direction) return;
  event.preventDefault();
  if (engine.gameOver) {
    restart();
    return;
  }
  handleDirectionInput(direction);
});

restartButton.addEventListener('click', restart);
gameOverEl.addEventListener('click', (event) => {
  if (event.target === gameOverEl) restart();
});

let touchStart = null;

canvas.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

canvas.addEventListener('touchend', (event) => {
  if (engine.gameOver) {
    restart();
    touchStart = null;
    return;
  }
  if (!touchStart) return;

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStart.x;
  const deltaY = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX && Math.abs(deltaY) < SWIPE_THRESHOLD_PX) return;

  const direction = Math.abs(deltaX) > Math.abs(deltaY)
    ? (deltaX > 0 ? 'right' : 'left')
    : (deltaY > 0 ? 'down' : 'up');
  handleDirectionInput(direction);
}, { passive: true });

canvas.addEventListener('touchcancel', () => {
  touchStart = null;
}, { passive: true });

new ResizeObserver(fitCanvas).observe(stage);
fitCanvas();
