# meanwaile-games

Game bundles for Meanwaile — open a PR to submit your own.

This repo is the source of the games offered inside the [Meanwaile](https://meanwaile.com) desktop app and on the website. Each game is a small, self-contained bundle: static HTML/CSS/JS, no build step, no external network calls.

## Adding a game

1. Fork this repo and create a new folder for your game under `games/`, e.g. `games/your-game-id/`.
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
  "version": "1.0.0",
  "tagline": "One short line describing it",
  "description": "A couple of sentences explaining how the game is played.",
  "entry": "index.html",
  "preview": "preview.png"
}
```

- `id` — unique, lowercase, kebab-case. Used to identify the game and prevent it from being installed twice.
- `name` — display name shown in the hub.
- `version` — semver string for this game's bundle. Bump it whenever you tag a new release (see below).
- `tagline` — short line shown under the name on the game's card.
- `description` — a couple of sentences explaining how the game is played, shown on the game's detail view.
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

- Add an entry for your game to `collection.json` (`{ "id": "your-game-id", "path": "games/your-game-id" }`), then serve the repo root with any static server, e.g. `npx serve .` or `python3 -m http.server`, and open `index.html`. It lists every game in `collection.json` and loads the selected one into an iframe, driving the same `game:pause`/`game:resume` contract the real host uses — good enough to sanity-check rendering, input, and the pause/resume overlay. It won't work opened directly via `file://`, since it fetches the manifests with `fetch()`.
- To test the real host behavior instead, drop your folder into a local checkout of the main [meanwaile](https://github.com/uurien/meanwaile) repo under `src/games/`, and add a temporary entry to `src/games/registry.js` pointing at it.
- See `games/circle-tap/` in this repo for a working example.

## Releasing a game

Games are released one at a time, not all at once — releasing one game doesn't rebuild or re-release the others.

1. Bump `version` in the game's `game.json` (semver), and update the matching `version` in the root `collection.json`. Merge that to `main` first.
2. Go to the [Release game](../../actions/workflows/release-game.yml) workflow under the Actions tab, click "Run workflow", and type the game's id (or `gh workflow run release-game.yml -f game=circle-tap`).
3. The workflow checks that id exists in `collection.json`, reads the version straight from that game's `game.json`, and fails immediately if a release for `<game-id>@<version>` already exists (bump the version and re-run if so). Otherwise it zips just that game's folder and publishes a GitHub Release tagged `<game-id>@<version>` with a `<game-id>-<version>.zip` asset — nothing else in the repo is touched.

Meanwaile fetches `collection.json` from `main` to know which games, ids, and versions exist, then downloads the matching release asset (`https://github.com/uurien/meanwaile-games/releases/download/<game-id>@<version>/<game-id>-<version>.zip`) to install or update a game.

## Game Room site

[gameroom.meanwaile.com](https://gameroom.meanwaile.com) is a public gallery for playing every game in `games/` straight from `main`, no install required. Its source lives in `site/` (plain HTML/CSS/JS, no build step) and reads `collection.json` and `games/` directly. Display metadata not covered by `game.json` (genre tag, controls hint, desktop-only flag) lives in `site/meta.js` — add an entry there for new games, otherwise generic defaults are shown.

`.github/workflows/deploy-gameroom.yml` deploys it to GitHub Pages on every push to `main`: it copies `site/`, `games/`, and `collection.json` into a staging folder and publishes that.
