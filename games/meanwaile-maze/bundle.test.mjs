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
      assert.equal(png.readUInt32BE(16), 26);
      assert.equal(png.readUInt32BE(20), 26);
    }
  }

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
  assert.match(source, /const MAZE_SIZE = 31/);
  assert.match(source, /const TILE_SIZE = 26/);
  assert.match(source, /const MAP_PREVIEW_MS = 10_000/);
  assert.match(source, /createMapModel/);
  assert.doesNotMatch(source, /x:\s*1,\s*y:\s*MAZE_SIZE - 2/);
  assert.match(source, /startFollow/);
  assert.match(source, /setScrollFactor\(0\)/);
});
