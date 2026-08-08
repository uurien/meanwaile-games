import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const gameRoot = new URL('./', import.meta.url);

test('the game manifest and collection entry describe the same offline bundle', async () => {
  const manifest = JSON.parse(await readFile(new URL('game.json', gameRoot), 'utf8'));
  const collection = JSON.parse(
    await readFile(new URL('../../collection.json', gameRoot), 'utf8'),
  );

  assert.deepEqual(manifest, {
    id: 'meanwaile-maze',
    name: 'Meanwaile Maze',
    version: '0.1.0',
    tagline: 'Find a way out',
    description:
      'Guide a tiny terminal through a maze of server racks. Use the arrow keys or WASD to reach the exit.',
    entry: 'index.html',
    preview: 'preview.png',
  });
  assert.ok(
    collection.games.some(
      (game) =>
        game.id === manifest.id &&
        game.path === 'games/meanwaile-maze' &&
        game.version === manifest.version,
    ),
  );
});

test('the entry point loads Phaser and game code locally with no network dependency', async () => {
  const html = await readFile(new URL('index.html', gameRoot), 'utf8');

  assert.match(html, /vendor\/phaser\.js/);
  assert.match(html, /meanwaile-maze\.js/);
  assert.doesNotMatch(html, /https?:\/\//);

  const phaser = await readFile(new URL('vendor/phaser.js', gameRoot), 'utf8');
  assert.match(phaser, /4\.2\.1/);
  await access(new URL('preview.png', gameRoot));

  for (const family of ['floor-below', 'rack-below']) {
    for (let variant = 1; variant <= 5; variant += 1) {
      const assetUrl = new URL(`assets/racks/${family}-${variant}.png`, gameRoot);
      await access(assetUrl);
      const png = await readFile(assetUrl);
      assert.equal(png.readUInt32BE(16), 78);
      assert.equal(png.readUInt32BE(20), 78);
    }
  }

  const floor = await readFile(new URL('assets/floor-resin.png', gameRoot));
  assert.equal(floor.readUInt32BE(16), 1024);
  assert.equal(floor.readUInt32BE(20), 1024);
  await assert.rejects(access(new URL('assets/floors/floor-1.png', gameRoot)));

  const freightLift = await readFile(
    new URL('assets/exit/freight-lift.png', gameRoot),
  );
  assert.equal(freightLift.readUInt32BE(16), 78);
  assert.equal(freightLift.readUInt32BE(20), 78);

  const paper = await readFile(
    new URL('assets/map-paper-template.png', gameRoot),
  );
  assert.equal(paper.readUInt32BE(16), 430);
  assert.equal(paper.readUInt32BE(20), 430);
  assert.equal(paper[25], 6);
});

test('the original rack artwork is kept with the game', async () => {
  const master = await readFile(
    new URL('source-art/rack-tiles-master.png', gameRoot),
  );

  assert.equal(master.readUInt32BE(16), 1536);
  assert.equal(master.readUInt32BE(20), 1024);
  await access(new URL('source-art/README.md', gameRoot));
});

test('the continuous resin floor source and approved concept are kept with the game', async () => {
  const master = await readFile(
    new URL('source-art/floor-resin-master.png', gameRoot),
  );

  assert.equal(master.readUInt32BE(16), master.readUInt32BE(20));
  assert.ok(master.readUInt32BE(16) >= 1024);
  await access(new URL('source-art/floor-resin-concept.png', gameRoot));
});

test('the selected character is bundled and every character concept is preserved', async () => {
  const player = await readFile(
    new URL('assets/characters/hooded-segway.png', gameRoot),
  );

  assert.equal(player.readUInt32BE(16), 256);
  assert.equal(player.readUInt32BE(20), 64);
  assert.equal(player[25], 6);

  for (const sheet of [
    'character-concepts-robots-humans.png',
    'character-concepts-hoodies-segways.png',
  ]) {
    const source = await readFile(new URL(`source-art/${sheet}`, gameRoot));
    assert.equal(source.readUInt32BE(16), 1254);
    assert.equal(source.readUInt32BE(20), 1254);
  }

  const transparentMaster = await readFile(
    new URL('source-art/hooded-segway-transparent-master.png', gameRoot),
  );
  assert.equal(transparentMaster[25], 6);
});

test('the map paper template is preserved with a transparent background', async () => {
  const template = await readFile(
    new URL('source-art/map-paper-template.png', gameRoot),
  );

  assert.equal(template.readUInt32BE(16), 1254);
  assert.equal(template.readUInt32BE(20), 1254);
  assert.equal(template[25], 6);
});

test('the Phaser scene uses the Meanwaile viewport and pause contract', async () => {
  const source = await readFile(new URL('meanwaile-maze.js', gameRoot), 'utf8');

  assert.match(source, /width:\s*GAME_WIDTH/);
  assert.match(source, /height:\s*GAME_HEIGHT/);
  assert.match(source, /Phaser\.Scale\.FIT/);
  assert.match(source, /Phaser\.Scale\.CENTER_BOTH/);
  assert.match(source, /game:pause/);
  assert.match(source, /game:resume/);
  assert.match(source, /this\.load\.image/);
  assert.match(source, /this\.add\.image/);
  assert.match(source, /rackTileKey/);
  assert.match(source, /floor-resin/);
  assert.match(source, /tileSprite/);
  assert.match(source, /floorTextureChunks/);
  assert.match(source, /rackShadowEdges/);
  assert.match(source, /floorDetailAt/);
  assert.match(
    source,
    /load\.image\('freight-lift', 'assets\/exit\/freight-lift\.png'\)/,
  );
  assert.match(
    source,
    /add\.image\(exitPosition\.x, exitPosition\.y, 'freight-lift'\)/,
  );
  assert.doesNotMatch(source, /function drawExit/);
  assert.match(source, /load\.spritesheet\('player-hooded-segway'/);
  assert.match(source, /frameWidth:\s*64/);
  assert.match(source, /frameHeight:\s*64/);
  assert.match(source, /playerFrameForDirection/);
  assert.match(source, /const PLAYER_SIZE = Math\.round\(TILE_SIZE \* 0\.8\)/);
  assert.match(source, /const MOVE_DURATION_MS = 140/);
  assert.match(source, /advanceContinuousPosition/);
  assert.match(source, /advanceMovement/);
  assert.match(source, /while \(remainingMs > 0/);
  assert.doesNotMatch(source, /this\.tweens\.add/);
  assert.doesNotMatch(source, /onComplete/);
  assert.doesNotMatch(source, /Sine\.Out/);
  assert.doesNotMatch(source, /nextMoveAt/);
  assert.doesNotMatch(source, /MOVE_INTERVAL_MS - 20/);
  assert.doesNotMatch(source, /this\.floor\.tilePosition/);
  assert.match(source, /const MAZE_SIZE = 31/);
  assert.match(source, /const TILE_SIZE = 78/);
  assert.match(source, /const MAP_PREVIEW_MS = 6_000/);
  assert.match(source, /createMapModel/);
  assert.doesNotMatch(source, /x:\s*1,\s*y:\s*MAZE_SIZE - 2/);
  assert.match(source, /startFollow/);
  assert.match(source, /setScrollFactor\(0\)/);
});
