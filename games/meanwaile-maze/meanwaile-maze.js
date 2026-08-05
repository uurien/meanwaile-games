import {
  advanceRoundClock,
  createMapModel,
  createRoundClock,
  createRuntimeState,
  generateMaze,
  movePlayer,
  rackTileKey,
  resolveDirection,
  transitionRuntime,
} from './logic.js';

const GAME_WIDTH = 440;
const GAME_HEIGHT = 470;
const MAZE_SIZE = 31;
const TILE_SIZE = 26;
const BOARD_X = 0;
const BOARD_Y = 0;
const WORLD_SIZE = MAZE_SIZE * TILE_SIZE;
const MOVE_INTERVAL_MS = 92;
const MAP_PREVIEW_MS = 10_000;
const MAP_CELL_SIZE = 22;
const MAP_X = 55;
const MAP_Y = 61;
const RACK_FAMILIES = ['floor-below', 'rack-below'];

const completeEl = document.getElementById('round-complete');
const finalTimeEl = document.getElementById('final-time');
const retryButton = document.getElementById('retry-button');

let game;
let sceneReady = false;
let runtime = createRuntimeState();

function cellCenter(position) {
  return {
    x: BOARD_X + position.x * TILE_SIZE + TILE_SIZE / 2,
    y: BOARD_Y + position.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function drawFloor(graphics, x, y) {
  graphics.fillStyle(0x090d0e);
  graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  graphics.lineStyle(1, 0x12191a, 1);
  graphics.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  graphics.fillStyle(0x172022);
  graphics.fillRect(x + 5, y + 5, 2, 2);
  graphics.fillRect(x + 19, y + 19, 2, 2);
}

function drawExit(graphics, x, y) {
  graphics.fillStyle(0x17341e);
  graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  graphics.lineStyle(1, 0x74ef79, 1);
  graphics.strokeRect(x + 2.5, y + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
  graphics.fillStyle(0xc9ffd0);
  graphics.fillRect(x + 8, y + 6, 10, 14);
}

function createTerminal(scene, position) {
  const terminal = scene.add.graphics();
  terminal.fillStyle(0x101719);
  terminal.fillRoundedRect(-7, -7, 14, 10, 3);
  terminal.lineStyle(1, 0x607077, 1);
  terminal.strokeRoundedRect(-7, -7, 14, 10, 3);
  terminal.fillStyle(0x071007);
  terminal.fillRoundedRect(-5, -5, 10, 6, 2);
  terminal.fillStyle(0x65f047);
  terminal.fillRect(-3, -3, 2, 2);
  terminal.fillRect(2, -3, 2, 2);
  terminal.fillStyle(0x1a2224);
  terminal.fillRect(-5, 3, 4, 4);
  terminal.fillRect(1, 3, 4, 4);

  const center = cellCenter(position);
  return scene.add.container(center.x, center.y, [terminal]).setScale(TILE_SIZE / 16);
}

function mapPoint(position) {
  return {
    x: MAP_X + position.x * MAP_CELL_SIZE,
    y: MAP_Y + position.y * MAP_CELL_SIZE,
  };
}

function drawMapMarker(graphics, position, color, type) {
  const point = mapPoint({ x: position.x + 0.5, y: position.y + 0.5 });
  graphics.lineStyle(2, color, 0.95);
  graphics.strokeCircle(point.x, point.y, 8);
  graphics.lineStyle(1, color, 0.45);
  graphics.strokeCircle(point.x + 1, point.y - 1, 8);

  if (type === 'terminal') {
    graphics.lineStyle(1.5, color, 1);
    graphics.strokeRect(point.x - 5, point.y - 4, 10, 8);
    graphics.fillStyle(color, 1);
    graphics.fillRect(point.x - 3, point.y - 2, 2, 2);
    graphics.fillRect(point.x + 1, point.y - 2, 2, 2);
    graphics.fillRect(point.x - 2, point.y + 2, 4, 1);
    return;
  }

  graphics.lineStyle(1.5, color, 1);
  graphics.strokeRect(point.x - 4, point.y - 5, 8, 10);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(point.x + 2, point.y, 1);
}

function createMapPreview(scene, maze) {
  const map = createMapModel(maze);
  const paper = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'map-paper')
    .setDisplaySize(430, 430);
  const drawing = scene.add.graphics();

  drawing.lineStyle(2, 0x292724, 0.9);
  for (const wall of map.walls) {
    const from = mapPoint(wall.from);
    const to = mapPoint(wall.to);
    drawing.lineBetween(from.x, from.y, to.x, to.y);
  }

  drawing.lineStyle(1, 0x625e57, 0.32);
  for (const wall of map.walls) {
    const from = mapPoint(wall.from);
    const to = mapPoint(wall.to);
    const jitter = ((wall.from.x * 3 + wall.from.y * 5) % 3) - 1;
    drawing.lineBetween(from.x + jitter, from.y + 1, to.x + jitter, to.y + 1);
  }

  drawMapMarker(drawing, map.start, 0x258a4a, 'terminal');
  drawMapMarker(drawing, map.exit, 0xb86816, 'exit');

  const countdown = scene.add.text(GAME_WIDTH / 2, 416, '10', {
    color: '#514d46',
    fontFamily: 'monospace',
    fontSize: '13px',
  }).setOrigin(0.5);
  const container = scene.add.container(0, 0, [paper, drawing, countdown])
    .setScrollFactor(0)
    .setDepth(1000);

  return { container, countdown };
}

class MazeScene extends Phaser.Scene {
  constructor() {
    super('maze');
  }

  preload() {
    if (!this.textures.exists('map-paper')) {
      this.load.image('map-paper', 'assets/map-paper-template.png');
    }
    for (const family of RACK_FAMILIES) {
      for (let variant = 1; variant <= 5; variant += 1) {
        const key = `rack-${family}-${variant}`;
        if (!this.textures.exists(key)) {
          this.load.image(key, `assets/racks/${family}-${variant}.png`);
        }
      }
    }
  }

  create() {
    this.maze = generateMaze(MAZE_SIZE, MAZE_SIZE);
    const map = createMapModel(this.maze);
    this.position = {
      x: map.start.x * 2 + 1,
      y: map.start.y * 2 + 1,
    };
    this.roundClock = createRoundClock(MAP_PREVIEW_MS);
    this.nextMoveAt = 0;

    this.cameras.main.setBackgroundColor('#050708');
    const board = this.add.graphics();
    board.fillStyle(0x050708);
    board.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    for (let row = 0; row < this.maze.length; row += 1) {
      for (let column = 0; column < this.maze[row].length; column += 1) {
        const x = BOARD_X + column * TILE_SIZE;
        const y = BOARD_Y + row * TILE_SIZE;
        const cell = this.maze[row][column];
        if (cell === '#') {
          this.add.image(x, y, rackTileKey(this.maze, column, row))
            .setOrigin(0, 0)
            .setDisplaySize(TILE_SIZE, TILE_SIZE);
        } else if (cell === 'E') {
          drawExit(board, x, y);
        } else {
          drawFloor(board, x, y);
        }
      }
    }

    this.add.text(20, 11, 'MAZE 01', {
      color: '#5af06d',
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setScrollFactor(0).setDepth(100);
    this.timer = this.add.text(GAME_WIDTH / 2, 11, '00:00', {
      color: '#5af06d',
      fontFamily: 'monospace',
      fontSize: '15px',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.add.text(20, 447, 'WASD / ARROWS', {
      color: '#438e51',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setScrollFactor(0).setDepth(100);
    this.add.text(381, 447, 'EXIT', {
      color: '#75e981',
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setScrollFactor(0).setDepth(100);

    this.player = createTerminal(this, this.position);
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.mapPreview = createMapPreview(this, this.maze);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    sceneReady = true;
    if (runtime.paused) this.game.pause();
  }

  update(time, delta) {
    if (runtime.completed) return;

    const previousPhase = this.roundClock.phase;
    this.roundClock = advanceRoundClock(this.roundClock, delta);
    if (this.roundClock.phase === 'preview') {
      this.mapPreview.countdown.setText(
        String(Math.ceil(this.roundClock.previewRemainingMs / 1000)),
      );
      return;
    }
    if (previousPhase === 'preview') {
      this.mapPreview.container.destroy(true);
      this.mapPreview = null;
      this.nextMoveAt = time + MOVE_INTERVAL_MS;
    }

    this.timer.setText(formatTime(this.roundClock.elapsedMs));
    if (time < this.nextMoveAt) return;

    const direction = resolveDirection({
      ArrowUp: this.cursors.up.isDown,
      ArrowRight: this.cursors.right.isDown,
      ArrowDown: this.cursors.down.isDown,
      ArrowLeft: this.cursors.left.isDown,
      w: this.wasd.W.isDown,
      d: this.wasd.D.isDown,
      s: this.wasd.S.isDown,
      a: this.wasd.A.isDown,
    });
    if (!direction) return;

    this.nextMoveAt = time + MOVE_INTERVAL_MS;
    const result = movePlayer(this.maze, this.position, direction);
    if (result.position === this.position) return;

    this.position = result.position;
    const center = cellCenter(this.position);
    this.tweens.add({
      targets: this.player,
      x: center.x,
      y: center.y,
      duration: MOVE_INTERVAL_MS - 20,
      ease: 'Sine.Out',
    });

    if (result.reachedExit) this.finishRound();
  }

  finishRound() {
    runtime = { paused: true, completed: true };
    finalTimeEl.textContent = `Time: ${formatTime(this.roundClock.elapsedMs)}`;
    completeEl.hidden = false;
    this.time.delayedCall(MOVE_INTERVAL_MS, () => this.game.pause());
  }
}

game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#050708',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scene: MazeScene,
});

window.addEventListener('message', (event) => {
  const messageType = event.data?.type;
  if (messageType !== 'game:pause' && messageType !== 'game:resume') return;

  runtime = transitionRuntime(runtime, messageType);
  if (!sceneReady || runtime.completed) return;
  if (runtime.paused && !game.isPaused) game.pause();
  if (!runtime.paused && game.isPaused) game.resume();
});

retryButton.addEventListener('click', () => {
  completeEl.hidden = true;
  runtime = { paused: false, completed: false };
  game.resume();
  game.scene.getScene('maze').scene.restart();
});
