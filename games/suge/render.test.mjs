import test from 'node:test';
import assert from 'node:assert/strict';

import { COLS, PREY_KINDS, ROWS } from './logic.js';
import {
  PREY_SPRITES,
  contentBoxSize,
  createDecorations,
  fitBoardToStage,
  preySpriteRect,
} from './render.js';

function sequenceRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('the sprite atlas maps every prey kind exactly once', () => {
  assert.deepEqual(Object.keys(PREY_SPRITES).sort(), [...PREY_KINDS].sort());

  const slots = Object.values(PREY_SPRITES).map(({ column, row }) => `${column},${row}`);
  assert.equal(new Set(slots).size, PREY_KINDS.length);
});

test('preySpriteRect returns square source cells from the 4 by 2 atlas', () => {
  assert.deepEqual(preySpriteRect('mouse', 1024, 512), {
    x: 0,
    y: 0,
    width: 256,
    height: 256,
  });
  assert.deepEqual(preySpriteRect('worm', 1024, 512), {
    x: 768,
    y: 256,
    width: 256,
    height: 256,
  });
  assert.equal(preySpriteRect('rabbit', 1024, 512), null);
});

test('fitBoardToStage preserves the game aspect ratio and stays within its stage', () => {
  for (const [width, height] of [[320, 286], [416, 390], [880, 820]]) {
    const fitted = fitBoardToStage(width, height, COLS / ROWS);
    assert.ok(fitted.width <= width);
    assert.ok(fitted.height <= height);
    assert.ok(Math.abs(fitted.width / fitted.height - COLS / ROWS) < 0.01);
    assert.ok(fitted.width > 0);
    assert.ok(fitted.height > 0);
  }
});

test('contentBoxSize removes stage padding without producing negative dimensions', () => {
  assert.deepEqual(contentBoxSize(440, 419, {
    paddingLeft: '11px',
    paddingRight: '11px',
    paddingTop: '4px',
    paddingBottom: '12px',
  }), { width: 418, height: 403 });

  assert.deepEqual(contentBoxSize(8, 8, {
    paddingLeft: '10px',
    paddingRight: '10px',
    paddingTop: '10px',
    paddingBottom: '10px',
  }), { width: 1, height: 1 });
});

test('decorations remain stable when generated with the same random sequence', () => {
  const values = [0.1, 0.9, 0.3, 0.8, 0.2, 0.7, 0.4, 0.6, 0.5];
  const first = createDecorations(24, sequenceRng(values), COLS, ROWS);
  const second = createDecorations(24, sequenceRng(values), COLS, ROWS);

  assert.deepEqual(first, second);
  assert.equal(first.length, 24);
  assert.ok(first.every(({ type }) => type === 'grass' || type === 'pebble'));
});
