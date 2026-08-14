// Display metadata not covered by game.json's contract (README.md) — kept
// here rather than growing the manifest schema that the app also consumes.
export const GAME_META = {
  'circle-tap': { tag: 'Reflex', controls: 'Click or tap', desktopOnly: false },
  'meanwaile-runner': { tag: 'Runner', controls: 'Space, click or tap', desktopOnly: false },
  'meanwaile-maze': { tag: 'Maze', controls: 'WASD or arrows', desktopOnly: true },
  suge: { tag: 'Arcade', controls: 'Arrows or WASD, swipe on touch', desktopOnly: false },
};

export function metaFor(id) {
  return GAME_META[id] || { tag: 'Game', controls: 'Keyboard & mouse', desktopOnly: false };
}
