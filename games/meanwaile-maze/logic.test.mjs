import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceContinuousPosition,
  advanceRoundClock,
  chooseMazeEndpoints,
  createMapModel,
  createRoundClock,
  createRuntimeState,
  floorDetailAt,
  floorDetailForRoll,
  floorTextureChunks,
  generateMaze,
  movePlayer,
  playerFrameForDirection,
  rackShadowEdges,
  rackTileKey,
  resolveDirection,
  transitionRuntime,
} from './logic.js';

function canReach(maze, start, exit) {
  const pending = [start];
  const visited = new Set([`${start.x},${start.y}`]);

  while (pending.length > 0) {
    const current = pending.shift();
    if (current.x === exit.x && current.y === exit.y) return true;

    for (const direction of [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = `${next.x},${next.y}`;
      if (maze[next.y]?.[next.x] !== '#' && !visited.has(key)) {
        visited.add(key);
        pending.push(next);
      }
    }
  }

  return false;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function logicalNeighbors(maze, position) {
  const neighbors = [];
  for (const direction of [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]) {
    const target = {
      x: position.x + direction.x,
      y: position.y + direction.y,
    };
    const wallX = (position.x * 2 + 1 + target.x * 2 + 1) / 2;
    const wallY = (position.y * 2 + 1 + target.y * 2 + 1) / 2;
    if (maze[wallY]?.[wallX] !== '#') neighbors.push(target);
  }
  return neighbors;
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

function findLogicalPath(maze, start, exit) {
  const pending = [start];
  const parents = new Map([[positionKey(start), null]]);

  while (pending.length > 0) {
    const current = pending.shift();
    if (current.x === exit.x && current.y === exit.y) break;
    for (const neighbor of logicalNeighbors(maze, current)) {
      const key = positionKey(neighbor);
      if (parents.has(key)) continue;
      parents.set(key, current);
      pending.push(neighbor);
    }
  }

  const path = [];
  let current = exit;
  while (current) {
    path.push(current);
    current = parents.get(positionKey(current));
  }
  return path.reverse();
}

function solutionDecoyDepths(maze, path) {
  const depths = [];
  for (let index = 0; index < path.length; index += 1) {
    const junction = path[index];
    const routeNeighbors = new Set(
      [path[index - 1], path[index + 1]].filter(Boolean).map(positionKey),
    );
    for (const branch of logicalNeighbors(maze, junction)) {
      if (routeNeighbors.has(positionKey(branch))) continue;
      const pending = [{ position: branch, depth: 1, previous: junction }];
      let nearestLeaf = Number.POSITIVE_INFINITY;
      while (pending.length > 0) {
        const current = pending.shift();
        const next = logicalNeighbors(maze, current.position).filter(
          (neighbor) => positionKey(neighbor) !== positionKey(current.previous),
        );
        if (next.length === 0) nearestLeaf = Math.min(nearestLeaf, current.depth);
        for (const neighbor of next) {
          pending.push({
            position: neighbor,
            depth: current.depth + 1,
            previous: current.position,
          });
        }
      }
      depths.push(nearestLeaf);
    }
  }
  return depths;
}

function mazeTopology(maze) {
  const width = (maze[0].length - 1) / 2;
  const height = (maze.length - 1) / 2;
  const cells = [];
  let edgeEnds = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = { x, y };
      const neighbors = logicalNeighbors(maze, position);
      cells.push({ position, degree: neighbors.length });
      edgeEnds += neighbors.length;
    }
  }

  return {
    cells,
    edges: edgeEnds / 2,
    junctions: cells.filter((cell) => cell.degree >= 3),
    deadEnds: cells.filter((cell) => cell.degree === 1),
  };
}

const maze = [
  '#####',
  '#...#',
  '#.#E#',
  '#...#',
  '#####',
];

test('arrow keys and WASD resolve to the same four directions', () => {
  assert.deepEqual(resolveDirection({ ArrowUp: true }), { x: 0, y: -1 });
  assert.deepEqual(resolveDirection({ w: true }), { x: 0, y: -1 });
  assert.deepEqual(resolveDirection({ ArrowRight: true }), { x: 1, y: 0 });
  assert.deepEqual(resolveDirection({ d: true }), { x: 1, y: 0 });
  assert.deepEqual(resolveDirection({ ArrowDown: true }), { x: 0, y: 1 });
  assert.deepEqual(resolveDirection({ s: true }), { x: 0, y: 1 });
  assert.deepEqual(resolveDirection({ ArrowLeft: true }), { x: -1, y: 0 });
  assert.deepEqual(resolveDirection({ a: true }), { x: -1, y: 0 });
});

test('no direction is emitted when no movement key was just pressed', () => {
  assert.equal(resolveDirection({}), null);
});

test('the hooded Segway uses one stable frame for each facing direction', () => {
  assert.equal(playerFrameForDirection({ x: 0, y: 1 }), 0);
  assert.equal(playerFrameForDirection({ x: -1, y: 0 }), 1);
  assert.equal(playerFrameForDirection({ x: 1, y: 0 }), 2);
  assert.equal(playerFrameForDirection({ x: 0, y: -1 }), 3);
});

test('continuous movement carries unused frame time into the next tile', () => {
  assert.deepEqual(
    advanceContinuousPosition(
      { x: 0, y: 0 },
      { x: 78, y: 0 },
      78 / 140,
      70,
    ),
    {
      position: { x: 39, y: 0 },
      reachedTarget: false,
      remainingMs: 0,
    },
  );

  assert.deepEqual(
    advanceContinuousPosition(
      { x: 0, y: 0 },
      { x: 78, y: 0 },
      78 / 140,
      150,
    ),
    {
      position: { x: 78, y: 0 },
      reachedTarget: true,
      remainingMs: 10,
    },
  );
});

test('the player moves one grid cell through a corridor', () => {
  assert.deepEqual(movePlayer(maze, { x: 1, y: 1 }, { x: 1, y: 0 }), {
    position: { x: 2, y: 1 },
    reachedExit: false,
  });
});

test('server-rack walls and map edges block movement', () => {
  assert.deepEqual(movePlayer(maze, { x: 1, y: 1 }, { x: -1, y: 0 }), {
    position: { x: 1, y: 1 },
    reachedExit: false,
  });
  assert.deepEqual(movePlayer(maze, { x: 0, y: 0 }, { x: 0, y: -1 }), {
    position: { x: 0, y: 0 },
    reachedExit: false,
  });
});

test('entering the exit cell completes the round', () => {
  assert.deepEqual(movePlayer(maze, { x: 3, y: 1 }, { x: 0, y: 1 }), {
    position: { x: 3, y: 2 },
    reachedExit: true,
  });
});

test('rack tiles expose a front only when the cell below is not another rack', () => {
  const layout = [
    '###',
    '.#.',
    '###',
  ];

  assert.match(rackTileKey(layout, 0, 0), /^rack-floor-below-/);
  assert.match(rackTileKey(layout, 1, 0), /^rack-rack-below-/);
  assert.match(rackTileKey(layout, 2, 2), /^rack-floor-below-/);
});

test('rack variants are deterministic and use the full five-tile set', () => {
  const layout = ['#####', '.....'];
  const keys = Array.from({ length: 5 }, (_, column) => rackTileKey(layout, column, 0));

  assert.deepEqual(keys, [
    'rack-floor-below-1',
    'rack-floor-below-2',
    'rack-floor-below-3',
    'rack-floor-below-4',
    'rack-floor-below-5',
  ]);
  assert.equal(rackTileKey(layout, 3, 0), rackTileKey(layout, 3, 0));
});

test('the continuous floor only adds a grille two percent of the time', () => {
  const details = Array.from({ length: 100 }, (_, roll) => floorDetailForRoll(roll));

  assert.equal(details.filter((detail) => detail === null).length, 98);
  assert.equal(details.filter((detail) => detail === 'grille').length, 2);
  assert.equal(floorDetailAt(7, 4), floorDetailAt(7, 4));
  assert.ok([null, 'grille'].includes(floorDetailAt(7, 5)));
});

test('rack shadows are emitted only along edges touching open floor', () => {
  const layout = [
    '#####',
    '#...#',
    '#.#.#',
    '#...#',
    '#####',
  ];
  const centerEdges = rackShadowEdges(layout).filter(
    (edge) => edge.column === 2 && edge.row === 2,
  );

  assert.deepEqual(
    centerEdges.map((edge) => edge.side).sort(),
    ['bottom', 'left', 'right', 'top'],
  );
});

test('floor texture chunks cover the world in aligned viewport-sized pieces', () => {
  const chunks = floorTextureChunks(10, 7, 4, 3);

  assert.deepEqual(chunks, [
    { x: 0, y: 0, width: 4, height: 3, tilePositionX: 0, tilePositionY: 0 },
    { x: 4, y: 0, width: 4, height: 3, tilePositionX: 4, tilePositionY: 0 },
    { x: 8, y: 0, width: 2, height: 3, tilePositionX: 8, tilePositionY: 0 },
    { x: 0, y: 3, width: 4, height: 3, tilePositionX: 0, tilePositionY: 3 },
    { x: 4, y: 3, width: 4, height: 3, tilePositionX: 4, tilePositionY: 3 },
    { x: 8, y: 3, width: 2, height: 3, tilePositionX: 8, tilePositionY: 3 },
    { x: 0, y: 6, width: 4, height: 1, tilePositionX: 0, tilePositionY: 6 },
    { x: 4, y: 6, width: 4, height: 1, tilePositionX: 4, tilePositionY: 6 },
    { x: 8, y: 6, width: 2, height: 1, tilePositionX: 8, tilePositionY: 6 },
  ]);
  assert.equal(
    chunks.reduce((area, chunk) => area + chunk.width * chunk.height, 0),
    70,
  );
});

test('a generated maze creates a 15 by 15 logical map and connects start to exit', () => {
  const generated = generateMaze(31, 31, () => 0.42);
  const map = createMapModel(generated);
  const start = { x: map.start.x * 2 + 1, y: map.start.y * 2 + 1 };
  const exit = { x: map.exit.x * 2 + 1, y: map.exit.y * 2 + 1 };

  assert.equal(generated.length, 31);
  assert.ok(generated.every((row) => row.length === 31));
  assert.ok(generated[0].split('').every((cell) => cell === '#'));
  assert.ok(generated[30].split('').every((cell) => cell === '#'));
  assert.equal(generated[start.y][start.x], 'S');
  assert.equal(generated[exit.y][exit.x], 'E');
  assert.equal(canReach(generated, start, exit), true);

  assert.equal(map.width, 15);
  assert.equal(map.height, 15);
  assert.notDeepEqual(map.start, map.exit);
  for (const endpoint of [map.start, map.exit]) {
    assert.ok(endpoint.x === 0 || endpoint.x === 14);
    assert.ok(endpoint.y === 0 || endpoint.y === 14);
  }
});

test('start and exit cover all ordered pairs of distinct corners', () => {
  const pairs = new Set();
  for (let startIndex = 0; startIndex < 4; startIndex += 1) {
    for (let exitOption = 0; exitOption < 3; exitOption += 1) {
      const values = [
        (startIndex + 0.25) / 4,
        (exitOption + 0.25) / 3,
      ];
      const { start, exit } = chooseMazeEndpoints(15, 15, () => values.shift());
      assert.notDeepEqual(start, exit);
      pairs.add(`${start.x},${start.y}->${exit.x},${exit.y}`);
    }
  }

  assert.equal(pairs.size, 12);
});

test('generated mazes have one route and select for deep misleading branches', () => {
  for (let seed = 1; seed <= 10; seed += 1) {
    const generated = generateMaze(31, 31, seededRandom(seed));
    const topology = mazeTopology(generated);
    assert.equal(topology.edges, topology.cells.length - 1);

    const map = createMapModel(generated);
    const solution = findLogicalPath(generated, map.start, map.exit);
    const decoyDepths = solutionDecoyDepths(generated, solution);

    assert.ok(solution.length - 1 >= 48);
    assert.ok(decoyDepths.length >= 6);
    assert.ok(decoyDepths.filter((depth) => depth < 3).length <= 1);
  }
});

test('the paper map converts physical rack tiles into logical wall lines', () => {
  const physicalMaze = [
    '#####',
    '#S..#',
    '###.#',
    '#..E#',
    '#####',
  ];

  const map = createMapModel(physicalMaze);

  assert.equal(map.width, 2);
  assert.equal(map.height, 2);
  assert.deepEqual(map.start, { x: 0, y: 0 });
  assert.deepEqual(map.exit, { x: 1, y: 1 });
  assert.equal(map.walls.length, 9);
  assert.ok(
    map.walls.some(
      (wall) =>
        wall.from.x === 0 &&
        wall.from.y === 1 &&
        wall.to.x === 1 &&
        wall.to.y === 1,
    ),
  );
});

test('the ten-second map preview does not consume playable round time', () => {
  const initial = createRoundClock(10_000);
  const almostReady = advanceRoundClock(initial, 9_750);
  const playing = advanceRoundClock(almostReady, 500);

  assert.deepEqual(initial, {
    phase: 'preview',
    previewRemainingMs: 10_000,
    elapsedMs: 0,
  });
  assert.deepEqual(almostReady, {
    phase: 'preview',
    previewRemainingMs: 250,
    elapsedMs: 0,
  });
  assert.deepEqual(playing, {
    phase: 'playing',
    previewRemainingMs: 0,
    elapsedMs: 250,
  });
});

test('the runtime starts paused and follows the Meanwaile message contract', () => {
  const initial = createRuntimeState();
  assert.deepEqual(initial, { paused: true, completed: false });

  const running = transitionRuntime(initial, 'game:resume');
  assert.deepEqual(running, { paused: false, completed: false });

  const paused = transitionRuntime(running, 'game:pause');
  assert.deepEqual(paused, { paused: true, completed: false });
});

test('a completed round ignores later resume messages', () => {
  const completed = { paused: true, completed: true };
  assert.deepEqual(transitionRuntime(completed, 'game:resume'), completed);
});
