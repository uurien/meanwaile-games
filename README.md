# meanwaile-games

Game bundles for Meanwaile — open a PR to submit your own.

This repo is the source of the games offered inside the [Meanwaile](https://meanwaile.com) desktop app and on the website. Each game is a small, self-contained bundle: static HTML/CSS/JS, no build step, no external network calls.

## Adding a game

1. Fork this repo and create a new folder for your game, e.g. `your-game-id/`.
2. Inside it, add:
   - `index.html` — the entry point loaded into the game view.
   - `game.json` — a small manifest (see below).
   - `preview.png` — a preview image shown on the game's card.
   - Any CSS/JS/assets your game needs, all referenced with relative paths inside your own folder.
3. Open a PR. Submissions are reviewed by hand.

Everything your game needs must live inside your folder — no CDN scripts, no fonts or assets loaded from the network. Your game runs fully offline.

### Manifest (`game.json`)

```json
{
  "id": "your-game-id",
  "name": "Your Game",
  "tagline": "One short line describing it",
  "entry": "index.html",
  "preview": "preview.png"
}
```

- `id` — unique, lowercase, kebab-case. Used to identify the game and prevent it from being installed twice.
- `name` — display name shown in the hub.
- `tagline` — short line shown under the name on the game's card.
- `entry` — relative path to the HTML file loaded into the game view.
- `preview` — relative path to the preview image.

## Runtime contract

Your game runs inside a sandboxed `<iframe>` — no Node, filesystem, or network access. The host (the app or the website) owns play/pause state entirely; your game does not manage its own start or pause screen.

On load, do **not** start your game loop, timers, or animation frames. The host will tell you when to start.

Listen for two message types on `window`:

```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'game:pause') {
    // stop your loop/timers/audio immediately
  }
  if (e.data?.type === 'game:resume') {
    // (re)start it
  }
});
```

- **`game:pause`** — sent whenever the player leaves your game: closing the popover, going back to the hub, an agent needing attention, etc. Stop any `requestAnimationFrame` loop, timers, and audio right away. Treat it as "freeze exactly where you are," not "reset."
- **`game:resume`** — sent only when the player explicitly starts or continues playing, after they've clicked "Start"/"Continue" on the host's own overlay. This first `game:resume` is also what kicks off your very first frame — there is no separate "on load" start. If a round has already ended, a later `game:resume` should be a no-op until the player restarts through your own UI (see `circle-tap` for an example: it ignores `game:resume` once `gameOver` is true).

Don't render your own "tap to start" or "paused" overlay — the host already shows one over your iframe, and the player can only ever reach your game after dismissing it.

## Viewport

For now, the viewport your game is designed for is **440×470px** — that's the space available inside the Meanwaile app's popover today. Your `index.html` is loaded into an `<iframe>` sized `width: 100%; height: 100%` of its container, so build your layout to scale rather than assuming those exact pixels: it should look good across different resolutions while keeping the same ~440:470 proportions. Use relative units (percentages/viewport units/flex/grid), not hardcoded pixel dimensions.

## Design constraints for submissions

- Keep rounds short: 30–90 seconds. No deep progression, streaks, or dailies — these are waiting-room games, not a destination.
- No network requests and no external assets, fonts, or CDNs — bundle everything in your folder.
- Namespace any `localStorage` keys with your game id to avoid colliding with other games (e.g. `circle-tap-record`).

## Testing locally

There's no tooling in this repo yet to preview a submission standalone. The simplest way to check your game today:

- Open your `index.html` directly in a browser to sanity-check rendering and input.
- To test the real pause/resume/overlay behavior, drop your folder into a local checkout of the main [meanwaile](https://github.com/uurien/meanwaile) repo under `src/games/`, and add a temporary entry to `src/games/registry.js` pointing at it.
