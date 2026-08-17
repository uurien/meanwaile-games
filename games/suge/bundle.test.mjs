import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const gameRoot = new URL('./', import.meta.url);

test('the manifest and collection entry describe the same offline game', async () => {
  const manifest = JSON.parse(await readFile(new URL('game.json', gameRoot), 'utf8'));
  const collection = JSON.parse(await readFile(new URL('../../collection.json', gameRoot), 'utf8'));

  assert.equal(manifest.id, 'suge');
  assert.equal(manifest.tagline, 'Eat, grow, and mind your tail');
  assert.equal(manifest.entry, 'index.html');
  assert.equal(manifest.preview, 'preview.png');
  assert.ok(collection.games.some((game) => (
    game.id === manifest.id
      && game.path === 'games/suge'
      && game.version === manifest.version
  )));
});

test('the entry point and styles reference only bundled resources', async () => {
  const html = await readFile(new URL('index.html', gameRoot), 'utf8');
  const css = await readFile(new URL('suge.css', gameRoot), 'utf8');
  const runtime = await readFile(new URL('suge.js', gameRoot), 'utf8');
  const renderer = await readFile(new URL('render.js', gameRoot), 'utf8');
  const bundleSource = [html, css, runtime, renderer].join('\n');
  const overlayRule = css.match(/\.overlay \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(html, /suge\.css/);
  assert.match(html, /suge\.js/);
  assert.match(css, /assets\/paper-texture\.png/);
  assert.match(runtime, /assets\/prey-atlas\.png/);
  assert.match(runtime, /from '\.\/runtime\.js'/);
  assert.match(runtime, /game:pause/);
  assert.match(runtime, /game:resume/);
  assert.match(runtime, /touchcancel/);
  assert.match(html, /id="collision-reason"/);
  assert.match(runtime, /collision: engine\.collision/);
  assert.match(runtime, /advancePreySpawns\(deltaMs\)/);
  assert.match(overlayRule, /justify-content:\s*center/);
  assert.match(overlayRule, /background:\s*transparent/);
  assert.doesNotMatch(runtime, /dataset\.placement/);
  assert.doesNotMatch(runtime, /^(?:loop\.start\(\)|requestAnimationFrame\()/m);
  assert.doesNotMatch(bundleSource, /https?:\/\//);
  assert.doesNotMatch(renderer, /[🍎🍏🍇🍑🍌🍒🥑🍉]/u);
});

test('the game remains self-contained and never opens a network channel', async () => {
  const files = ['index.html', 'suge.css', 'suge.js', 'runtime.js', 'render.js', 'logic.js'];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, gameRoot), 'utf8')),
  );
  const bundleSource = sources.join('\n');

  assert.doesNotMatch(bundleSource, /\bfetch\s*\(/);
  assert.doesNotMatch(bundleSource, /XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(bundleSource, /new\s+Audio\b/);
});

test('the generated paper and prey artwork is bundled in runtime and source form', async () => {
  const paper = await readFile(new URL('assets/paper-texture.png', gameRoot));
  const atlas = await readFile(new URL('assets/prey-atlas.png', gameRoot));

  assert.equal(paper.readUInt32BE(16), 768);
  assert.equal(paper.readUInt32BE(20), 768);
  assert.equal(atlas.readUInt32BE(16), 1024);
  assert.equal(atlas.readUInt32BE(20), 512);
  assert.equal(atlas[25], 6, 'the runtime atlas must be RGBA');

  await access(new URL('source-art/paper-texture-master.png', gameRoot));
  await access(new URL('source-art/prey-atlas-chroma-master.png', gameRoot));
  await access(new URL('source-art/README.md', gameRoot));
});

test('the gallery preview keeps the Meanwaile viewport dimensions', async () => {
  const preview = await readFile(new URL('preview.png', gameRoot));
  assert.equal(preview.readUInt32BE(16), 440);
  assert.equal(preview.readUInt32BE(20), 470);
});
