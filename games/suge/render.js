export const INK = '#49463f';
export const PAPER_WASH = 'rgba(250, 246, 235, 0.34)';
export const BODY_FILL = '#ddd4c2';
export const GRAPHITE_GHOST = 'rgba(76, 72, 64, 0.24)';
export const DECORATION_INK = 'rgba(73, 70, 63, 0.58)';

export const PREY_SPRITES = {
  mouse: { column: 0, row: 0 },
  frog: { column: 1, row: 0 },
  lizard: { column: 2, row: 0 },
  chick: { column: 3, row: 0 },
  beetle: { column: 0, row: 1 },
  snail: { column: 1, row: 1 },
  fish: { column: 2, row: 1 },
  worm: { column: 3, row: 1 },
};

const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 2;

const DIRECTION_ANGLE = {
  up: -Math.PI / 2,
  down: Math.PI / 2,
  left: Math.PI,
  right: 0,
};

function clampedRandom(rng) {
  return Math.max(0, Math.min(0.999999999, rng()));
}

function noise(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function wordSeed(word) {
  let result = 0;
  for (let i = 0; i < word.length; i += 1) {
    result = (result * 31 + word.charCodeAt(i)) >>> 0;
  }
  return result;
}

export function fitBoardToStage(stageWidth, stageHeight, aspectRatio) {
  const safeWidth = Math.max(1, stageWidth);
  const safeHeight = Math.max(1, stageHeight);
  const safeAspect = aspectRatio > 0 ? aspectRatio : 1;

  if (safeWidth / safeHeight > safeAspect) {
    return { width: safeHeight * safeAspect, height: safeHeight };
  }
  return { width: safeWidth, height: safeWidth / safeAspect };
}

export function contentBoxSize(elementWidth, elementHeight, style) {
  const horizontalPadding = parseFloat(style.paddingLeft || '0')
    + parseFloat(style.paddingRight || '0');
  const verticalPadding = parseFloat(style.paddingTop || '0')
    + parseFloat(style.paddingBottom || '0');
  return {
    width: Math.max(1, elementWidth - horizontalPadding),
    height: Math.max(1, elementHeight - verticalPadding),
  };
}

export function preySpriteRect(kind, atlasWidth, atlasHeight) {
  const sprite = PREY_SPRITES[kind];
  if (!sprite || atlasWidth <= 0 || atlasHeight <= 0) return null;
  const width = atlasWidth / ATLAS_COLUMNS;
  const height = atlasHeight / ATLAS_ROWS;
  return {
    x: sprite.column * width,
    y: sprite.row * height,
    width,
    height,
  };
}

export function createDecorations(count, rng, cols, rows) {
  const decorations = [];
  for (let i = 0; i < count; i += 1) {
    decorations.push({
      x: 0.9 + clampedRandom(rng) * Math.max(0.1, cols - 1.8),
      y: 0.9 + clampedRandom(rng) * Math.max(0.1, rows - 1.8),
      type: clampedRandom(rng) < 0.58 ? 'grass' : 'pebble',
      rotation: clampedRandom(rng) * Math.PI * 2,
      scale: 0.72 + clampedRandom(rng) * 0.58,
    });
  }
  return decorations;
}

function roundedRectanglePath(ctx, width, height, inset, radius, phase = 0) {
  const left = inset + noise(phase + 1) * 0.45;
  const top = inset + noise(phase + 2) * 0.45;
  const right = width - inset + noise(phase + 3) * 0.45;
  const bottom = height - inset + noise(phase + 4) * 0.45;
  const topLeftRadius = radius + noise(phase + 5) * 1.2;
  const topRightRadius = radius + noise(phase + 6) * 1.2;
  const bottomRightRadius = radius + noise(phase + 7) * 1.2;
  const bottomLeftRadius = radius + noise(phase + 8) * 1.2;

  ctx.beginPath();
  ctx.moveTo(left + topLeftRadius, top);
  ctx.lineTo(right - topRightRadius, top + noise(phase + 9) * 0.55);
  ctx.quadraticCurveTo(right, top, right, top + topRightRadius);
  ctx.lineTo(right + noise(phase + 10) * 0.55, bottom - bottomRightRadius);
  ctx.quadraticCurveTo(right, bottom, right - bottomRightRadius, bottom);
  ctx.lineTo(left + bottomLeftRadius, bottom + noise(phase + 11) * 0.55);
  ctx.quadraticCurveTo(left, bottom, left, bottom - bottomLeftRadius);
  ctx.lineTo(left + noise(phase + 12) * 0.55, top + topLeftRadius);
  ctx.quadraticCurveTo(left, top, left + topLeftRadius, top);
  ctx.closePath();
}

function drawBoardFill(ctx, width, height, cellSize) {
  const inset = Math.max(2.5, cellSize * 0.16);
  const radius = Math.max(13, cellSize * 0.72);
  roundedRectanglePath(ctx, width, height, inset, radius, 13);
  ctx.fillStyle = PAPER_WASH;
  ctx.fill();
}

function drawBoardFrame(ctx, width, height, cellSize) {
  const radius = Math.max(13, cellSize * 0.72);
  const passes = [
    { inset: 2.8, phase: 31, alpha: 0.82, width: 1.35 },
    { inset: 4.2, phase: 47, alpha: 0.43, width: 0.9 },
    { inset: 2.1, phase: 73, alpha: 0.25, width: 0.75 },
  ];

  ctx.save();
  ctx.strokeStyle = INK;
  for (const pass of passes) {
    roundedRectanglePath(ctx, width, height, pass.inset, radius, pass.phase);
    ctx.globalAlpha = pass.alpha;
    ctx.lineWidth = pass.width;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrassTuft(ctx, centerX, centerY, cellSize, decoration) {
  const height = cellSize * 0.34 * decoration.scale;
  const spread = cellSize * 0.17 * decoration.scale;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(decoration.rotation);
  ctx.strokeStyle = DECORATION_INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.65, cellSize * 0.043);

  for (let pass = 0; pass < 2; pass += 1) {
    ctx.globalAlpha = pass === 0 ? 0.84 : 0.3;
    ctx.translate(pass === 0 ? 0 : 0.55, pass === 0 ? 0 : -0.2);
    for (const sign of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(sign * spread * 0.72, height * 0.38);
      ctx.quadraticCurveTo(
        sign * spread * 0.9,
        -height * 0.12,
        sign * spread + noise(decoration.x * 7 + sign) * cellSize * 0.025,
        -height * 0.62,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPebble(ctx, centerX, centerY, cellSize, decoration) {
  const width = cellSize * 0.25 * decoration.scale;
  const height = cellSize * 0.14 * decoration.scale;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(decoration.rotation);
  ctx.strokeStyle = DECORATION_INK;
  ctx.lineWidth = Math.max(0.65, cellSize * 0.044);
  ctx.beginPath();
  ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.26;
  ctx.beginPath();
  ctx.ellipse(0.6, -0.25, width * 0.9, height * 1.04, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawDecorations(ctx, decorations, cellSize) {
  for (const decoration of decorations) {
    const centerX = decoration.x * cellSize;
    const centerY = decoration.y * cellSize;
    if (decoration.type === 'grass') {
      drawGrassTuft(ctx, centerX, centerY, cellSize, decoration);
    } else {
      drawPebble(ctx, centerX, centerY, cellSize, decoration);
    }
  }
}

function drawFallbackPrey(ctx, animal, cellSize) {
  const centerX = (animal.x + 0.5) * cellSize;
  const centerY = (animal.y + 0.5) * cellSize;
  ctx.save();
  ctx.fillStyle = 'rgba(124, 116, 100, 0.72)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.8, cellSize * 0.06);
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, cellSize * 0.35, cellSize * 0.31, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawPrey(ctx, animal, cellSize, preyAtlas, animationMs = 0) {
  if (!preyAtlas?.complete || preyAtlas.naturalWidth <= 0) {
    drawFallbackPrey(ctx, animal, cellSize);
    return;
  }

  const source = preySpriteRect(animal.kind, preyAtlas.naturalWidth, preyAtlas.naturalHeight);
  if (!source) return;

  const phase = wordSeed(animal.kind) * 0.001 + animal.x * 0.71 + animal.y * 1.13;
  const bob = Math.sin(animationMs * 0.0032 + phase) * cellSize * 0.045;
  const rotation = noise(phase) * 0.045;
  const scale = 1 + Math.sin(animationMs * 0.0025 + phase) * 0.014;
  const drawSize = cellSize * 1.7 * scale;

  ctx.save();
  ctx.translate((animal.x + 0.5) * cellSize, (animal.y + 0.5) * cellSize + bob);
  ctx.rotate(rotation);
  ctx.globalAlpha = 0.96;
  ctx.drawImage(
    preyAtlas,
    source.x,
    source.y,
    source.width,
    source.height,
    -drawSize / 2,
    -drawSize / 2,
    drawSize,
    drawSize,
  );
  ctx.restore();
}

function snakePoints(snake, previousSnake, cellSize, interpolation) {
  return snake.map((segment, index) => {
    const previous = previousSnake[index] ?? previousSnake.at(-1) ?? segment;
    return {
      x: (previous.x + (segment.x - previous.x) * interpolation + 0.5) * cellSize,
      y: (previous.y + (segment.y - previous.y) * interpolation + 0.5) * cellSize,
    };
  });
}

function traceSmoothSnake(ctx, points, offsetX = 0, offsetY = 0) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    const next = points[i + 1];
    ctx.quadraticCurveTo(
      point.x + offsetX,
      point.y + offsetY,
      (point.x + next.x) / 2 + offsetX,
      (point.y + next.y) / 2 + offsetY,
    );
  }
  const tail = points.at(-1);
  ctx.lineTo(tail.x + offsetX, tail.y + offsetY);
}

function drawHead(ctx, head, cellSize, direction, animationMs) {
  const angle = DIRECTION_ANGLE[direction] ?? 0;
  const tongueReach = cellSize * (0.22 + (Math.sin(animationMs * 0.007) + 1) * 0.025);

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);

  ctx.fillStyle = GRAPHITE_GHOST;
  ctx.beginPath();
  ctx.ellipse(cellSize * 0.055, cellSize * 0.065, cellSize * 0.55, cellSize * 0.43, 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BODY_FILL;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.1, cellSize * 0.085);
  ctx.beginPath();
  ctx.ellipse(0, 0, cellSize * 0.55, cellSize * 0.43, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(0.65, cellSize * 0.043);
  ctx.beginPath();
  ctx.ellipse(cellSize * 0.018, -cellSize * 0.012, cellSize * 0.53, cellSize * 0.41, -0.035, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cellSize * 0.2, sign * cellSize * 0.18, Math.max(1.15, cellSize * 0.062), 0, Math.PI * 2);
    ctx.fill();
  }

  const tongueStart = cellSize * 0.5;
  const tongueEnd = tongueStart + tongueReach;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.9, cellSize * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tongueStart, 0);
  ctx.lineTo(tongueEnd, 0);
  ctx.stroke();
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(tongueEnd, 0);
    ctx.lineTo(tongueEnd + cellSize * 0.17, sign * cellSize * 0.12);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawSnake(
  ctx,
  snake,
  previousSnake,
  cellSize,
  direction,
  interpolation = 1,
  animationMs = 0,
) {
  const points = snakePoints(
    snake,
    previousSnake ?? snake,
    cellSize,
    Math.max(0, Math.min(1, interpolation)),
  );
  if (points.length === 0) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = GRAPHITE_GHOST;
  ctx.lineWidth = cellSize * 0.96;
  traceSmoothSnake(ctx, points, cellSize * 0.07, cellSize * 0.08);
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = cellSize * 0.88;
  traceSmoothSnake(ctx, points);
  ctx.stroke();

  ctx.globalAlpha = 0.33;
  ctx.lineWidth = cellSize * 0.92;
  traceSmoothSnake(ctx, points, -cellSize * 0.025, cellSize * 0.018);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = BODY_FILL;
  ctx.lineWidth = cellSize * 0.68;
  traceSmoothSnake(ctx, points);
  ctx.stroke();

  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#726b5f';
  ctx.lineWidth = Math.max(0.8, cellSize * 0.06);
  ctx.setLineDash([cellSize * 0.32, cellSize * 0.14]);
  traceSmoothSnake(ctx, points, -cellSize * 0.06, -cellSize * 0.055);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawHead(ctx, points[0], cellSize, direction, animationMs);
}

export function drawScene(ctx, {
  width,
  height,
  cols,
  rows,
  cellSize,
  snake,
  previousSnake,
  prey,
  direction,
  decorations,
  preyAtlas,
  interpolation = 1,
  animationMs = 0,
}) {
  ctx.clearRect(0, 0, width, height);
  drawBoardFill(ctx, width, height, cellSize);
  if (decorations) drawDecorations(ctx, decorations, cellSize);
  for (const animal of prey ?? []) drawPrey(ctx, animal, cellSize, preyAtlas, animationMs);
  drawSnake(ctx, snake, previousSnake, cellSize, direction, interpolation, animationMs);
  drawBoardFrame(ctx, cols * cellSize, rows * cellSize, cellSize);
}
