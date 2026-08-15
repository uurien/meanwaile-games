import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const gameRoot = new URL('./', import.meta.url);

test('the Typewall bundle is registered and self-contained', async () => {
  const manifest = JSON.parse(await readFile(new URL('game.json', gameRoot), 'utf8'));
  const collection = JSON.parse(
    await readFile(new URL('../../collection.json', gameRoot), 'utf8'),
  );

  assert.deepEqual(manifest, {
    id: 'meanwaile-typewall',
    name: 'Typewall',
    version: '1.0.0',
    tagline: 'Type fast. Hold the line.',
    description:
      'Destroy falling terminal words before they tear through the wall. Type a match and press Enter to blast every copy at once.',
    entry: 'index.html',
    preview: 'preview.png',
  });
  assert.ok(
    collection.games.some(
      (game) =>
        game.id === manifest.id &&
        game.path === 'games/meanwaile-typewall' &&
        game.version === manifest.version,
    ),
  );
  await access(new URL('preview.png', gameRoot));
  const preview = await readFile(new URL('preview.png', gameRoot));
  assert.equal(preview.readUInt32BE(16), 440);
  assert.equal(preview.readUInt32BE(20), 470);
});

test('the entry point uses only local assets and the Meanwaile lifecycle contract', async () => {
  const html = await readFile(new URL('index.html', gameRoot), 'utf8');
  const source = await readFile(new URL('meanwaile-typewall.js', gameRoot), 'utf8');

  assert.match(html, /width="440"/);
  assert.match(html, /height="470"/);
  assert.match(html, /meanwaile-typewall\.css/);
  assert.match(html, /meanwaile-typewall\.js/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(source, /game:pause/);
  assert.match(source, /game:resume/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /preventDefault/);
  assert.doesNotMatch(source, /pause-button|pause-icon|boss|level/i);
});

test('the renderer preserves the fixed logical composition', async () => {
  const source = await readFile(new URL('meanwaile-typewall.js', gameRoot), 'utf8');
  const logic = await readFile(new URL('logic.js', gameRoot), 'utf8');

  assert.match(source, /LOGICAL_WIDTH = 440/);
  assert.match(source, /LOGICAL_HEIGHT = 470/);
  assert.match(logic, /WALL_ROWS = 3/);
  assert.match(logic, /CHAIN_SEGMENTS = 5/);
  assert.match(source, /HEART_COUNT = 5/);
  assert.match(source, /drawKey\('ESC'/);
  assert.match(source, /':  clear'/);
  assert.match(source, /drawKey\('ENTER'/);
  assert.match(source, /':  destroy'/);
});

test('the lower instruction uses compact pixel spacing to stay inside 440px', async () => {
  const source = await readFile(new URL('meanwaile-typewall.js', gameRoot), 'utf8');

  assert.match(
    source,
    /'Type the words and press ENTER',[\s\S]*?spacing: 0/,
  );
  assert.match(
    source,
    /'to destroy all matches\.',[\s\S]*?spacing: 0/,
  );
});
