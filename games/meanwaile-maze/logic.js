const DIRECTIONS = [
  { keys: ['ArrowUp', 'w', 'W'], vector: { x: 0, y: -1 } },
  { keys: ['ArrowRight', 'd', 'D'], vector: { x: 1, y: 0 } },
  { keys: ['ArrowDown', 's', 'S'], vector: { x: 0, y: 1 } },
  { keys: ['ArrowLeft', 'a', 'A'], vector: { x: -1, y: 0 } },
];

const LOGICAL_DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const MAZE_CANDIDATES = 512;
const TARGET_DECOYS = 6;

function logicalIndex(position, width) {
  return position.y * width + position.x;
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function physicalCenter(position) {
  return { x: position.x * 2 + 1, y: position.y * 2 + 1 };
}

export function chooseMazeEndpoints(width, height, rng = Math.random) {
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  const startIndex = Math.min(Math.floor(rng() * corners.length), corners.length - 1);
  const possibleExits = corners.filter((_, index) => index !== startIndex);
  const exitIndex = Math.min(
    Math.floor(rng() * possibleExits.length),
    possibleExits.length - 1,
  );
  return { start: corners[startIndex], exit: possibleExits[exitIndex] };
}

function openLogicalNeighbors(grid, position, width, height) {
  const center = physicalCenter(position);
  return LOGICAL_DIRECTIONS.map((direction) => ({
    x: position.x + direction.x,
    y: position.y + direction.y,
    direction,
  })).filter(({ x, y, direction }) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return grid[center.y + direction.y][center.x + direction.x] !== '#';
  });
}

function createDepthFirstCandidate(width, height, start, rng) {
  const physicalWidth = width * 2 + 1;
  const physicalHeight = height * 2 + 1;
  const grid = Array.from(
    { length: physicalHeight },
    () => Array(physicalWidth).fill('#'),
  );
  const stack = [start];
  const visited = new Set([logicalIndex(start, width)]);
  const startCenter = physicalCenter(start);
  grid[startCenter.y][startCenter.x] = '.';

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = LOGICAL_DIRECTIONS.map((direction) => ({
      x: current.x + direction.x,
      y: current.y + direction.y,
      direction,
    })).filter(
      ({ x, y }) =>
        x >= 0 &&
        x < width &&
        y >= 0 &&
        y < height &&
        !visited.has(logicalIndex({ x, y }, width)),
    );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const choiceIndex = Math.min(
      Math.floor(rng() * candidates.length),
      candidates.length - 1,
    );
    const next = candidates[choiceIndex];
    const currentCenter = physicalCenter(current);
    const nextCenter = physicalCenter(next);
    grid[currentCenter.y + next.direction.y][currentCenter.x + next.direction.x] = '.';
    grid[nextCenter.y][nextCenter.x] = '.';
    visited.add(logicalIndex(next, width));
    stack.push({ x: next.x, y: next.y });
  }

  return grid;
}

function findLogicalSolution(grid, width, height, start, exit) {
  const pending = [start];
  const parents = new Map([[positionKey(start), null]]);

  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index];
    if (current.x === exit.x && current.y === exit.y) break;
    for (const neighbor of openLogicalNeighbors(grid, current, width, height)) {
      const key = positionKey(neighbor);
      if (parents.has(key)) continue;
      parents.set(key, current);
      pending.push({ x: neighbor.x, y: neighbor.y });
    }
  }

  const solution = [];
  let current = exit;
  while (current) {
    solution.push(current);
    current = parents.get(positionKey(current));
  }
  return solution.reverse();
}

function nearestLeafDepth(grid, width, height, junction, branch) {
  const pending = [{ position: branch, depth: 1 }];
  const visited = new Set([positionKey(junction), positionKey(branch)]);
  let nearest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index];
    const next = openLogicalNeighbors(grid, current.position, width, height).filter(
      (neighbor) => !visited.has(positionKey(neighbor)),
    );
    if (next.length === 0) nearest = Math.min(nearest, current.depth);
    for (const neighbor of next) {
      visited.add(positionKey(neighbor));
      pending.push({ position: neighbor, depth: current.depth + 1 });
    }
  }

  return nearest;
}

function candidateScore(grid, width, height, start, exit) {
  const solution = findLogicalSolution(grid, width, height, start, exit);
  const decoyDepths = [];

  for (let index = 0; index < solution.length; index += 1) {
    const junction = solution[index];
    const routeNeighbors = new Set(
      [solution[index - 1], solution[index + 1]].filter(Boolean).map(positionKey),
    );
    for (const branch of openLogicalNeighbors(grid, junction, width, height)) {
      if (routeNeighbors.has(positionKey(branch))) continue;
      decoyDepths.push(nearestLeafDepth(grid, width, height, junction, branch));
    }
  }

  const shallowDecoys = decoyDepths.filter((depth) => depth < 3).length;
  const minimumDepth = decoyDepths.length > 0 ? Math.min(...decoyDepths) : 0;
  return [
    -Math.max(0, TARGET_DECOYS - decoyDepths.length),
    -shallowDecoys,
    minimumDepth,
    Math.min(decoyDepths.length, 10),
    solution.length - 1,
    decoyDepths.reduce((total, depth) => total + Math.min(depth, 10), 0),
  ];
}

function isBetterScore(score, bestScore) {
  if (!bestScore) return true;
  for (let index = 0; index < score.length; index += 1) {
    if (score[index] !== bestScore[index]) return score[index] > bestScore[index];
  }
  return false;
}

export function generateMaze(width, height, rng = Math.random) {
  if (width < 5 || height < 5 || width % 2 === 0 || height % 2 === 0) {
    throw new Error('Maze dimensions must be odd numbers of at least 5');
  }

  const logicalWidth = (width - 1) / 2;
  const logicalHeight = (height - 1) / 2;
  const endpoints = chooseMazeEndpoints(logicalWidth, logicalHeight, rng);
  let grid;
  let bestScore;
  for (let candidate = 0; candidate < MAZE_CANDIDATES; candidate += 1) {
    const candidateGrid = createDepthFirstCandidate(
      logicalWidth,
      logicalHeight,
      endpoints.start,
      rng,
    );
    const score = candidateScore(
      candidateGrid,
      logicalWidth,
      logicalHeight,
      endpoints.start,
      endpoints.exit,
    );
    if (isBetterScore(score, bestScore)) {
      grid = candidateGrid;
      bestScore = score;
    }
  }

  const start = physicalCenter(endpoints.start);
  const exit = physicalCenter(endpoints.exit);

  grid[start.y][start.x] = 'S';
  grid[exit.y][exit.x] = 'E';
  return grid.map((row) => row.join(''));
}

export function resolveDirection(pressedKeys) {
  for (const direction of DIRECTIONS) {
    if (direction.keys.some((key) => pressedKeys[key])) {
      return direction.vector;
    }
  }
  return null;
}

export function movePlayer(maze, position, direction) {
  const target = {
    x: position.x + direction.x,
    y: position.y + direction.y,
  };
  const targetCell = maze[target.y]?.[target.x];

  if (!targetCell || targetCell === '#') {
    return { position, reachedExit: false };
  }

  return {
    position: target,
    reachedExit: targetCell === 'E',
  };
}

export function rackTileKey(maze, column, row) {
  const family = maze[row + 1]?.[column] === '#' ? 'rack-below' : 'floor-below';
  const variant = ((column + row * 2) % 5) + 1;
  return `rack-${family}-${variant}`;
}

export function floorDetailForRoll(roll) {
  const normalizedRoll = ((Math.floor(roll) % 100) + 100) % 100;
  return normalizedRoll < 98 ? null : 'grille';
}

export function floorDetailAt(column, row) {
  let hash = Math.imul(column + 1, 374_761_393);
  hash ^= Math.imul(row + 1, 668_265_263);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  const roll = ((hash ^ (hash >>> 16)) >>> 0) % 100;
  return floorDetailForRoll(roll);
}

export function rackShadowEdges(maze) {
  const directions = [
    { column: 0, row: -1, side: 'top' },
    { column: 1, row: 0, side: 'right' },
    { column: 0, row: 1, side: 'bottom' },
    { column: -1, row: 0, side: 'left' },
  ];
  const edges = [];

  for (let row = 0; row < maze.length; row += 1) {
    for (let column = 0; column < maze[row].length; column += 1) {
      if (maze[row][column] !== '#') continue;
      for (const direction of directions) {
        const neighbor = maze[row + direction.row]?.[column + direction.column];
        if (neighbor && neighbor !== '#') {
          edges.push({ column, row, side: direction.side });
        }
      }
    }
  }

  return edges;
}

export function floorTextureChunks(worldWidth, worldHeight, chunkWidth, chunkHeight) {
  const chunks = [];
  for (let y = 0; y < worldHeight; y += chunkHeight) {
    for (let x = 0; x < worldWidth; x += chunkWidth) {
      chunks.push({
        x,
        y,
        width: Math.min(chunkWidth, worldWidth - x),
        height: Math.min(chunkHeight, worldHeight - y),
        tilePositionX: x,
        tilePositionY: y,
      });
    }
  }
  return chunks;
}

export function createMapModel(maze) {
  const physicalHeight = maze.length;
  const physicalWidth = maze[0]?.length ?? 0;
  if (
    physicalWidth < 5 ||
    physicalHeight < 5 ||
    physicalWidth % 2 === 0 ||
    physicalHeight % 2 === 0 ||
    maze.some((row) => row.length !== physicalWidth)
  ) {
    throw new Error('A map requires a rectangular odd-sized physical maze');
  }

  const width = (physicalWidth - 1) / 2;
  const height = (physicalHeight - 1) / 2;
  const walls = [];
  let start;
  let exit;

  for (let y = 0; y <= height; y += 1) {
    const physicalY = y * 2;
    for (let x = 0; x < width; x += 1) {
      if (maze[physicalY][x * 2 + 1] === '#') {
        walls.push({ from: { x, y }, to: { x: x + 1, y } });
      }
    }
  }

  for (let x = 0; x <= width; x += 1) {
    const physicalX = x * 2;
    for (let y = 0; y < height; y += 1) {
      if (maze[y * 2 + 1][physicalX] === '#') {
        walls.push({ from: { x, y }, to: { x, y: y + 1 } });
      }
    }
  }

  for (let physicalY = 1; physicalY < physicalHeight; physicalY += 2) {
    for (let physicalX = 1; physicalX < physicalWidth; physicalX += 2) {
      const marker = maze[physicalY][physicalX];
      const position = {
        x: (physicalX - 1) / 2,
        y: (physicalY - 1) / 2,
      };
      if (marker === 'S') start = position;
      if (marker === 'E') exit = position;
    }
  }

  if (!start || !exit) {
    throw new Error('A map requires start and exit markers');
  }

  return { width, height, start, exit, walls };
}

export function createRoundClock(previewDurationMs = 10_000) {
  return {
    phase: 'preview',
    previewRemainingMs: previewDurationMs,
    elapsedMs: 0,
  };
}

export function advanceRoundClock(state, deltaMs) {
  const delta = Math.max(0, deltaMs);
  if (state.phase === 'playing') {
    return { ...state, elapsedMs: state.elapsedMs + delta };
  }

  const previewRemainingMs = state.previewRemainingMs - delta;
  if (previewRemainingMs > 0) {
    return { ...state, previewRemainingMs };
  }

  return {
    phase: 'playing',
    previewRemainingMs: 0,
    elapsedMs: state.elapsedMs + Math.abs(previewRemainingMs),
  };
}

export function createRuntimeState() {
  return { paused: true, completed: false };
}

export function transitionRuntime(state, messageType) {
  if (messageType === 'game:pause') {
    return { ...state, paused: true };
  }
  if (messageType === 'game:resume' && !state.completed) {
    return { ...state, paused: false };
  }
  return state;
}
