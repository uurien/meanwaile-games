import {
  CHAIN_SEGMENTS,
  DEFAULT_CONFIG,
  firstVisibleCharacterIndex,
  MAX_HEALTH,
  TypewallEngine,
  WALL_ROWS,
} from './logic.js';

const LOGICAL_WIDTH = 440;
const LOGICAL_HEIGHT = 470;
const HEART_COUNT = 5;
const GREEN = '#8dce47';
const GREEN_BRIGHT = '#a7e858';
const GREEN_DIM = '#345f20';
const BACKGROUND = '#030806';

const BLOCK_TOP_PATTERNS = [
  ['1111111011111101111', '1101111110111111111', '1111001111111011110', '0010000110010001000'],
  ['1110111111101111111', '1111110111111101111', '1011111110011111101', '0001100001000100100'],
  ['1111101111111110111', '1110111111011111111', '1111110011111100111', '0100010000110001000'],
  ['1111111110111111101', '1101111111110111111', '1110011111111001110', '0011000100001100010'],
  ['1111011111110111111', '1111111101111111011', '1001111111100111111', '0100001010000011000'],
];

const canvas = document.getElementById('game');
const context = canvas.getContext('2d', { alpha: false });
context.imageSmoothingEnabled = false;

const GLYPHS = {
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','11011','10001'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
  a: ['00000','00000','01110','00001','01111','10001','01111'],
  b: ['10000','10000','10110','11001','10001','10001','11110'],
  c: ['00000','00000','01111','10000','10000','10000','01111'],
  d: ['00001','00001','01101','10011','10001','10001','01111'],
  e: ['00000','00000','01110','10001','11111','10000','01111'],
  f: ['00110','01001','01000','11100','01000','01000','01000'],
  g: ['00000','01111','10001','10001','01111','00001','01110'],
  h: ['10000','10000','10110','11001','10001','10001','10001'],
  i: ['00100','00000','01100','00100','00100','00100','01110'],
  j: ['00010','00000','00110','00010','00010','10010','01100'],
  k: ['10000','10000','10010','10100','11000','10100','10010'],
  l: ['01100','00100','00100','00100','00100','00100','01110'],
  m: ['00000','00000','11010','10101','10101','10101','10101'],
  n: ['00000','00000','10110','11001','10001','10001','10001'],
  o: ['00000','00000','01110','10001','10001','10001','01110'],
  p: ['00000','00000','11110','10001','11110','10000','10000'],
  q: ['00000','00000','01111','10001','01111','00001','00001'],
  r: ['00000','00000','10111','11000','10000','10000','10000'],
  s: ['00000','00000','01111','10000','01110','00001','11110'],
  t: ['01000','01000','11100','01000','01000','01001','00110'],
  u: ['00000','00000','10001','10001','10001','10011','01101'],
  v: ['00000','00000','10001','10001','10001','01010','00100'],
  w: ['00000','00000','10001','10101','10101','10101','01010'],
  x: ['00000','00000','10001','01010','00100','01010','10001'],
  y: ['00000','00000','10001','10001','01111','00001','01110'],
  z: ['00000','00000','11111','00010','00100','01000','11111'],
  0: ['01110','10001','10011','10101','11001','10001','01110'],
  1: ['00100','01100','00100','00100','00100','00100','01110'],
  2: ['01110','10001','00001','00010','00100','01000','11111'],
  3: ['11110','00001','00001','01110','00001','00001','11110'],
  4: ['00010','00110','01010','10010','11111','00010','00010'],
  5: ['11111','10000','10000','11110','00001','00001','11110'],
  6: ['01110','10000','10000','11110','10001','10001','01110'],
  7: ['11111','00001','00010','00100','01000','01000','01000'],
  8: ['01110','10001','10001','01110','10001','10001','01110'],
  9: ['01110','10001','10001','01111','00001','00001','01110'],
  ':': ['00000','00100','00100','00000','00100','00100','00000'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  '>': ['10000','01000','00100','00010','00100','01000','10000'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

const engine = new TypewallEngine();
let frameId = null;
let lastFrameAt = null;
let hostActive = false;
let displayNow = 0;

function pixelTextWidth(text, scale = 1, spacing = 1) {
  if (text.length === 0) return 0;
  return text.length * (5 * scale + spacing * scale) - spacing * scale;
}

function drawPixelText(text, x, y, {
  scale = 1,
  color = GREEN,
  alpha = 1,
  align = 'left',
  spacing = 1,
  glow = 0,
} = {}) {
  const normalized = String(text);
  let drawX = Math.round(x);
  const width = pixelTextWidth(normalized, scale, spacing);
  if (align === 'center') drawX -= Math.floor(width / 2);
  if (align === 'right') drawX -= width;

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  if (glow > 0) {
    context.shadowColor = color;
    context.shadowBlur = glow;
  }
  for (const character of normalized) {
    const glyph = GLYPHS[character] ?? GLYPHS[' '];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === '1') {
          context.fillRect(drawX + column * scale, y + row * scale, scale, scale);
        }
      }
    }
    drawX += (5 + spacing) * scale;
  }
  context.restore();
}

function drawFrame() {
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  context.strokeStyle = 'rgba(141, 206, 71, 0.58)';
  context.lineWidth = 1;
  chamferedRect(5.5, 6.5, 429, 457, 4);
  context.stroke();
  context.strokeStyle = 'rgba(141, 206, 71, 0.18)';
  chamferedRect(8.5, 9.5, 423, 451, 3);
  context.stroke();
  context.fillStyle = 'rgba(141, 206, 71, 0.32)';
  dottedLine(12, 51, 416);
}

function chamferedRect(x, y, width, height, corner) {
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.lineTo(x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.lineTo(x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.lineTo(x, y + height - corner);
  context.lineTo(x, y + corner);
  context.closePath();
}

function dottedLine(x, y, width) {
  for (let offset = 0; offset < width; offset += 3) context.fillRect(x + offset, y, 2, 1);
}

function drawHud() {
  drawPixelText('SCORE', 17, 19, { color: GREEN });
  drawPixelText(formatScore(engine.score), 17, 33, { color: GREEN_BRIGHT, glow: 4 });

  drawPixelText('WPM', 98, 19, { color: GREEN });
  drawPixelText(String(engine.getWpm(displayNow)), 100, 33, { color: GREEN_BRIGHT, glow: 4 });

  drawPixelText(`CHAIN  x${engine.chainMultiplier}`, 148, 19, { color: GREEN });
  const segmentX = 148;
  for (let index = 0; index < CHAIN_SEGMENTS; index += 1) {
    const x = segmentX + index * 10;
    context.strokeStyle = index < engine.chainProgress ? GREEN_BRIGHT : GREEN_DIM;
    context.strokeRect(x + 0.5, 34.5, 7, 7);
    if (index < engine.chainProgress) {
      context.fillStyle = GREEN;
      context.shadowColor = GREEN;
      context.shadowBlur = 4;
      context.fillRect(x + 2, 36, 4, 4);
      context.shadowBlur = 0;
    }
  }

  drawPixelText('HEALTH', 331, 19, { color: GREEN });
  for (let index = 0; index < HEART_COUNT; index += 1) {
    drawHeart(331 + index * 18, 33, index < engine.health);
  }
}

function formatScore(score) {
  const absolute = String(Math.abs(score)).padStart(score < 0 ? 5 : 6, '0');
  return score < 0 ? `-${absolute}` : absolute;
}

function drawHeart(x, y, filled) {
  const heart = ['0110110','1111111','1111111','0111110','0011100','0001000'];
  context.save();
  context.fillStyle = filled ? GREEN_BRIGHT : GREEN_DIM;
  context.shadowColor = GREEN;
  context.shadowBlur = filled ? 4 : 0;
  for (let row = 0; row < heart.length; row += 1) {
    for (let column = 0; column < heart[row].length; column += 1) {
      const isEdge = heart[row][column] === '1' && (
        !heart[row - 1]?.[column] || heart[row - 1][column] === '0' ||
        !heart[row + 1]?.[column] || heart[row + 1][column] === '0' ||
        heart[row][column - 1] !== '1' || heart[row][column + 1] !== '1'
      );
      if (filled ? heart[row][column] === '1' : isEdge) {
        context.fillRect(x + column * 2, y + row * 2, 2, 2);
      }
    }
  }
  context.restore();
}

function columnCenter(column) {
  return DEFAULT_CONFIG.boardLeft + column * DEFAULT_CONFIG.columnWidth + DEFAULT_CONFIG.columnWidth / 2;
}

function drawVerticalWord(
  word,
  firstIndex = 0,
  lastIndex = word.text.length - 1,
  alpha = 1,
) {
  const x = columnCenter(word.column);
  const top = word.y - (word.text.length - 1 - firstIndex) * DEFAULT_CONFIG.characterStep;
  context.strokeStyle = `rgba(119, 179, 59, ${0.14 * alpha})`;
  for (let y = 55; y < top - 4; y += 4) context.strokeRect(Math.round(x) - 1.5, y + 0.5, 2, 2);
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const y = word.y - (word.text.length - 1 - index) * DEFAULT_CONFIG.characterStep;
    drawPixelText(word.text[index], x, Math.round(y) - 7, {
      align: 'center', color: GREEN_BRIGHT, alpha, glow: 3,
    });
  }
}

function drawWords() {
  for (const word of engine.activeWords) {
    drawVerticalWord(word, firstVisibleCharacterIndex(word, engine.config));
  }
  for (const animation of engine.destroyingWords) {
    drawVerticalWord(animation, 0, animation.nextCharacterIndex, 0.78);
  }
}

function drawWall() {
  const { boardLeft, columnWidth, wallY, wallRowHeight } = DEFAULT_CONFIG;
  for (let row = 0; row < WALL_ROWS; row += 1) {
    for (let column = 0; column < DEFAULT_CONFIG.columns; column += 1) {
      if (!engine.blocks[row][column]) continue;
      drawWallBlock(
        Math.round(boardLeft + column * columnWidth),
        wallY + row * wallRowHeight,
        Math.floor(columnWidth) - 1,
        wallRowHeight - 2,
        column,
        row,
      );
    }
  }
}

function drawWallBlock(x, y, width, height, column, row) {
  const seed = column * 17 + row * 31;

  context.fillStyle = '#33561f';
  context.fillRect(x, y + 2, width, height - 2);
  context.strokeStyle = '#649b35';
  context.strokeRect(x + 0.5, y + 2.5, width - 1, height - 3);

  context.fillStyle = '#27471b';
  for (let stain = 0; stain < 4; stain += 1) {
    const stainX = x + 2 + ((seed + stain * 5) % (width - 4));
    const stainY = y + 5 + ((seed + stain * 7) % 5);
    context.fillRect(stainX, stainY, 2, Math.min(height - (stainY - y) - 1, 4 + (stain % 3)));
  }

  const topPattern = BLOCK_TOP_PATTERNS[seed % BLOCK_TOP_PATTERNS.length];
  context.save();
  context.shadowColor = GREEN_BRIGHT;
  context.shadowBlur = 2;
  for (let patternY = 0; patternY < topPattern.length; patternY += 1) {
    context.fillStyle = patternY < 2 ? GREEN_BRIGHT : '#78b73d';
    for (let patternX = 0; patternX < width; patternX += 1) {
      if (topPattern[patternY][patternX] === '1') {
        context.fillRect(x + patternX, y + patternY, 1, 1);
      }
    }
  }
  context.restore();

  context.fillStyle = '#091108';
  for (let holeRow = 0; holeRow < 4; holeRow += 1) {
    for (let holeColumn = 0; holeColumn < 6; holeColumn += 1) {
      const holeX = x + 2 + holeColumn * 3;
      const holeY = y + 6 + holeRow * 3;
      if (holeX < x + width - 1 && holeY < y + height - 1) {
        context.fillRect(holeX, holeY, 1, 1);
      }
    }
  }

  context.fillStyle = '#29491b';
  for (let patch = 0; patch < 3; patch += 1) {
    const patchX = x + 2 + ((seed * 2 + patch * 7) % (width - 5));
    const patchY = y + 7 + ((seed + patch * 5) % Math.max(1, height - 10));
    context.fillRect(patchX, patchY, 2 + (patch % 2), 2);
  }
  context.fillStyle = '#73aa3b';
  context.fillRect(x + 3 + (seed % Math.max(1, width - 7)), y + 5, 1, 2);

  context.fillStyle = 'rgba(157, 218, 83, 0.24)';
  context.fillRect(x + 1, y + 4, 1, height - 5);
  context.fillRect(x + width - 2, y + 5, 1, height - 7);
}

function drawParticles() {
  context.save();
  context.shadowColor = GREEN;
  context.shadowBlur = 3;
  for (const particle of engine.particles) {
    context.globalAlpha = particle.alpha * (particle.kind === 'block' ? 0.9 : 0.78);
    context.fillStyle = particle.kind === 'breach' ? GREEN_DIM : GREEN_BRIGHT;
    if (particle.size >= 2) {
      context.strokeStyle = context.fillStyle;
      context.strokeRect(Math.round(particle.x) + 0.5, Math.round(particle.y) + 0.5, particle.size, particle.size);
    } else {
      context.fillRect(Math.round(particle.x), Math.round(particle.y), 1, 1);
    }
  }
  context.restore();
}

function drawInputAndControls() {
  context.strokeStyle = 'rgba(141, 206, 71, 0.53)';
  chamferedRect(14.5, 369.5, 411, 36, 4);
  context.stroke();
  context.fillStyle = 'rgba(9, 40, 22, 0.2)';
  chamferedRect(16, 371, 408, 33, 3);
  context.fill();
  drawPixelText('>', 27, 380, { scale: 2, color: GREEN_BRIGHT, glow: 4 });
  drawPixelText(engine.input, 45, 380, { scale: 2, color: GREEN_BRIGHT, glow: 5 });
  const cursorX = 45 + pixelTextWidth(engine.input, 2) + 2;
  context.fillStyle = GREEN;
  context.fillRect(cursorX, 380, 7, 14);
  context.strokeStyle = GREEN_BRIGHT;
  context.strokeRect(cursorX + 0.5, 380.5, 6, 13);

  drawKey('ESC', 17, 423, 31);
  drawPixelText(':  clear', 52, 432, { color: GREEN });
  context.fillStyle = GREEN_DIM;
  context.fillRect(104, 422, 1, 27);
  drawKey('ENTER', 120, 423, 40);
  drawPixelText(':  destroy', 164, 432, { color: GREEN });
  context.fillRect(223, 422, 1, 27);
  drawDocumentIcon(242, 423);
  drawPixelText('Type the words and press ENTER', 260, 426, {
    color: GREEN, spacing: 0,
  });
  drawPixelText('to destroy all matches.', 260, 439, {
    color: GREEN, spacing: 0,
  });
}

function drawKey(label, x, y, width) {
  context.strokeStyle = 'rgba(141, 206, 71, 0.6)';
  chamferedRect(x + 0.5, y + 0.5, width, 26, 3);
  context.stroke();
  drawPixelText(label, x + width / 2, y + 9, { align: 'center', color: GREEN_BRIGHT });
}

function drawDocumentIcon(x, y) {
  context.strokeStyle = GREEN_DIM;
  context.strokeRect(x + 0.5, y + 0.5, 10, 14);
  context.beginPath();
  context.moveTo(x + 7.5, y + 0.5);
  context.lineTo(x + 10.5, y + 3.5);
  context.lineTo(x + 7.5, y + 3.5);
  context.closePath();
  context.stroke();
  context.fillStyle = GREEN_DIM;
  context.fillRect(x + 2, y + 6, 6, 1);
  context.fillRect(x + 2, y + 9, 6, 1);
}

function drawGameOver() {
  context.fillStyle = 'rgba(2, 8, 5, 0.91)';
  context.fillRect(46, 111, 348, 170);
  context.strokeStyle = GREEN;
  context.strokeRect(46.5, 111.5, 347, 169);
  drawPixelText('GAME OVER', 220, 134, {
    scale: 3, align: 'center', color: GREEN_BRIGHT, glow: 8,
  });
  drawPixelText(`SCORE ${engine.score}`, 220, 186, {
    scale: 2, align: 'center', color: GREEN,
  });
  drawPixelText(`WPM ${engine.getWpm(displayNow)}`, 220, 212, {
    scale: 2, align: 'center', color: GREEN,
  });
  drawPixelText('PRESS ENTER TO RESTART', 220, 253, {
    align: 'center', color: GREEN_DIM,
  });
}

function drawCrtTexture() {
  context.save();
  context.fillStyle = 'rgba(141, 206, 71, 0.025)';
  for (let index = 0; index < 105; index += 1) {
    const x = (index * 83 + 17) % LOGICAL_WIDTH;
    const y = (index * 47 + 29) % LOGICAL_HEIGHT;
    context.fillRect(x, y, 1, 1);
  }
  context.fillStyle = 'rgba(0, 0, 0, 0.09)';
  for (let y = 1; y < LOGICAL_HEIGHT; y += 3) context.fillRect(0, y, LOGICAL_WIDTH, 1);
  context.restore();
}

function render(now = displayNow) {
  displayNow = now;
  drawFrame();
  drawHud();
  drawWords();
  drawWall();
  drawParticles();
  drawInputAndControls();
  if (engine.gameOver) drawGameOver();
  drawCrtTexture();
}

function setUpPreviewScene() {
  engine.score = 1_240;
  engine.chainMultiplier = 14;
  engine.chainProgress = 3;
  engine.health = 4;
  engine.input = 'docker';
  engine.destroyedWordTimes = Array.from({ length: 92 }, (_, index) => -index * 500);
  const words = [
    ['docker', 2, 180],
    ['ls', 5, 232],
    ['python', 7, 205],
    ['docker', 10, 224],
    ['rust', 13, 157],
    ['git', 15, 231],
    ['node', 18, 225],
  ];
  for (const [text, column, y] of words) {
    engine.addWord(text, { column, y });
  }
  for (let column = 7; column <= 12; column += 1) engine.blocks[0][column] = false;
  for (let column = 8; column <= 11; column += 1) engine.blocks[1][column] = false;
  for (let column = 9; column <= 10; column += 1) engine.blocks[2][column] = false;
  for (let index = 0; index < 38; index += 1) {
    engine.particles.push({
      id: 10_000 + index,
      kind: 'block',
      x: 165 + ((index * 37) % 112),
      y: 230 + ((index * 29) % 105),
      vx: 0,
      vy: -10,
      lifeMs: 500,
      maxLifeMs: 500,
      alpha: 0.25 + (index % 4) * 0.18,
      size: index % 3 === 0 ? 2 : 1,
    });
  }
}

function loop(now) {
  if (!hostActive) return;
  if (lastFrameAt === null) lastFrameAt = now;
  engine.update(now - lastFrameAt);
  lastFrameAt = now;
  render(now);
  frameId = requestAnimationFrame(loop);
}

function startLoop() {
  if (frameId !== null || !hostActive) return;
  lastFrameAt = null;
  frameId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  lastFrameAt = null;
}

window.addEventListener('keydown', (event) => {
  const controlled = event.key === 'Enter' || event.key === 'Escape' || event.key === 'Backspace';
  if (controlled) event.preventDefault();
  if (!hostActive) return;
  const wasGameOver = engine.gameOver;
  if (engine.handleKey(event.key, performance.now())) {
    if (/^[a-z0-9]$/iu.test(event.key)) event.preventDefault();
    render(performance.now());
    if (wasGameOver && !engine.gameOver) startLoop();
  }
});

window.addEventListener('message', (event) => {
  if (event.data?.type === 'game:pause') {
    hostActive = false;
    stopLoop();
  }
  if (event.data?.type === 'game:resume') {
    hostActive = true;
    startLoop();
  }
});

if (new URLSearchParams(window.location.search).has('preview')) setUpPreviewScene();
render(0);
