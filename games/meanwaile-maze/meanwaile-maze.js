import {
  advanceContinuousPosition,
  advanceRoundClock,
  createMapModel,
  createRoundClock,
  createRuntimeState,
  floorDetailAt,
  floorTextureChunks,
  generateMaze,
  movePlayer,
  playerFrameForDirection,
  rackShadowEdges,
  rackTileKey,
  resolveDirection,
  transitionRuntime,
} from './logic.js';

const GAME_WIDTH = 440;
const GAME_HEIGHT = 470;
const MAZE_SIZE = 31;
const TILE_SIZE = 78;
const PLAYER_SIZE = Math.round(TILE_SIZE * 0.8);
const TILE_DETAIL_SCALE = TILE_SIZE / 26;
const BOARD_X = 0;
const BOARD_Y = 0;
const WORLD_SIZE = MAZE_SIZE * TILE_SIZE;
const MOVE_DURATION_MS = 140;
const MOVE_SPEED = TILE_SIZE / MOVE_DURATION_MS;
const MAP_PREVIEW_MS = 6_000;
const MAP_CELL_SIZE = 22;
const MAP_X = 55;
const MAP_Y = 61;
const RACK_FAMILIES = ['floor-below', 'rack-below'];
const SHADOW_BANDS = 5;

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

function drawFloorGrille(graphics, column, row) {
  const centerX = BOARD_X + (column + 0.5) * TILE_SIZE;
  const centerY = BOARD_Y + (row + 0.5) * TILE_SIZE;
  const horizontal = (column + row) % 2 === 0;
  const width = (horizontal ? 11 : 5) * TILE_DETAIL_SCALE;
  const height = (horizontal ? 5 : 11) * TILE_DETAIL_SCALE;
  const x = centerX - width / 2;
  const y = centerY - height / 2;

  graphics.fillStyle(0x101313, 0.92);
  graphics.fillRect(x, y, width, height);
  graphics.lineStyle(TILE_DETAIL_SCALE / 2, 0x394141, 0.8);
  graphics.strokeRect(x, y, width, height);
  graphics.lineStyle(TILE_DETAIL_SCALE / 2, 0x090b0b, 0.9);
  const bars = 5;
  for (let index = 1; index <= bars; index += 1) {
    const ratio = index / (bars + 1);
    if (horizontal) {
      graphics.lineBetween(
        x + TILE_DETAIL_SCALE,
        y + height * ratio,
        x + width - TILE_DETAIL_SCALE,
        y + height * ratio,
      );
    } else {
      graphics.lineBetween(
        x + width * ratio,
        y + TILE_DETAIL_SCALE,
        x + width * ratio,
        y + height - TILE_DETAIL_SCALE,
      );
    }
  }
}

function drawRackShadows(graphics, edges) {
  const bandSize = TILE_DETAIL_SCALE;
  for (const edge of edges) {
    const x = BOARD_X + edge.column * TILE_SIZE;
    const y = BOARD_Y + edge.row * TILE_SIZE;
    for (let band = 0; band < SHADOW_BANDS; band += 1) {
      const alpha = 0.24 * ((SHADOW_BANDS - band) / SHADOW_BANDS) ** 2;
      graphics.fillStyle(0x000000, alpha);
      if (edge.side === 'top') {
        graphics.fillRect(x, y - (band + 1) * bandSize, TILE_SIZE, bandSize);
      } else if (edge.side === 'right') {
        graphics.fillRect(x + TILE_SIZE + band * bandSize, y, bandSize, TILE_SIZE);
      } else if (edge.side === 'bottom') {
        graphics.fillRect(x, y + TILE_SIZE + band * bandSize, TILE_SIZE, bandSize);
      } else {
        graphics.fillRect(x - (band + 1) * bandSize, y, bandSize, TILE_SIZE);
      }
    }
  }
}

function createFloor(scene) {
  for (const chunk of floorTextureChunks(
    WORLD_SIZE,
    WORLD_SIZE,
    GAME_WIDTH,
    GAME_HEIGHT,
  )) {
    const floor = scene.add.tileSprite(
      chunk.x,
      chunk.y,
      chunk.width,
      chunk.height,
      'floor-resin',
    )
      .setOrigin(0, 0)
      .setScrollFactor(1)
      .setDepth(-20);
    floor.tilePositionX = chunk.tilePositionX;
    floor.tilePositionY = chunk.tilePositionY;
  }
}

function createPlayer(scene, position) {
  const center = cellCenter(position);
  return scene.add.sprite(center.x, center.y, 'player-hooded-segway', 0)
    .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
    .setDepth(2);
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

  const countdown = scene.add.text(GAME_WIDTH / 2, 416, String(Math.ceil(MAP_PREVIEW_MS / 1000)), {
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
    if (!this.textures.exists('floor-resin')) {
      this.load.image('floor-resin', 'assets/floor-resin.png');
    }
    if (!this.textures.exists('freight-lift')) {
      this.load.image('freight-lift', 'assets/exit/freight-lift.png');
    }
    if (!this.textures.exists('player-hooded-segway')) {
      this.load.spritesheet('player-hooded-segway', 'assets/characters/hooded-segway.png', {
        frameWidth: 64,
        frameHeight: 64,
      });
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
    this.moveTarget = null;

    this.cameras.main.setBackgroundColor('#050708');
    createFloor(this);
    const shadows = this.add.graphics().setDepth(-10);
    const floorDetails = this.add.graphics().setDepth(-5);
    drawRackShadows(shadows, rackShadowEdges(this.maze));
    let exitPosition;

    for (let row = 0; row < this.maze.length; row += 1) {
      for (let column = 0; column < this.maze[row].length; column += 1) {
        const x = BOARD_X + column * TILE_SIZE;
        const y = BOARD_Y + row * TILE_SIZE;
        const cell = this.maze[row][column];
        if (cell === '#') {
          this.add.image(x, y, rackTileKey(this.maze, column, row))
            .setOrigin(0, 0)
            .setDisplaySize(TILE_SIZE, TILE_SIZE)
            .setDepth(0);
        } else {
          if (
            cell !== 'S' &&
            cell !== 'E' &&
            floorDetailAt(column, row) === 'grille'
          ) {
            drawFloorGrille(floorDetails, column, row);
          }
          if (cell === 'E') exitPosition = { x, y };
        }
      }
    }

    if (exitPosition) {
      this.add.image(exitPosition.x, exitPosition.y, 'freight-lift')
        .setOrigin(0, 0)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(1);
    }

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

    this.player = createPlayer(this, this.position);
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.mapPreview = createMapPreview(this, this.maze);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    sceneReady = true;
    if (runtime.paused) this.game.pause();
  }

  readDirection() {
    return resolveDirection({
      ArrowUp: this.cursors.up.isDown,
      ArrowRight: this.cursors.right.isDown,
      ArrowDown: this.cursors.down.isDown,
      ArrowLeft: this.cursors.left.isDown,
      w: this.wasd.W.isDown,
      d: this.wasd.D.isDown,
      s: this.wasd.S.isDown,
      a: this.wasd.A.isDown,
    });
  }

  planMove() {
    if (this.moveTarget || runtime.completed || this.roundClock.phase !== 'playing') {
      return false;
    }

    const direction = this.readDirection();
    if (!direction) return false;

    this.player.setFrame(playerFrameForDirection(direction));
    const result = movePlayer(this.maze, this.position, direction);
    if (result.position === this.position) return false;

    this.position = result.position;
    const center = cellCenter(this.position);
    this.moveTarget = {
      x: center.x,
      y: center.y,
      reachedExit: result.reachedExit,
    };
    return true;
  }

  advanceMovement(delta) {
    let remainingMs = Math.max(0, delta);

    while (remainingMs > 0 && !runtime.completed) {
      if (!this.moveTarget && !this.planMove()) return;

      const step = advanceContinuousPosition(
        { x: this.player.x, y: this.player.y },
        this.moveTarget,
        MOVE_SPEED,
        remainingMs,
      );
      this.player.setPosition(step.position.x, step.position.y);
      remainingMs = step.remainingMs;

      if (!step.reachedTarget) return;

      const reachedExit = this.moveTarget.reachedExit;
      this.moveTarget = null;
      if (reachedExit) {
        this.finishRound();
        return;
      }
    }
  }

  update(_time, delta) {
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
    }

    this.timer.setText(formatTime(this.roundClock.elapsedMs));
    this.advanceMovement(delta);
  }

  finishRound() {
    runtime = { paused: true, completed: true };
    finalTimeEl.textContent = `Time: ${formatTime(this.roundClock.elapsedMs)}`;
    completeEl.hidden = false;
    this.game.pause();
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
