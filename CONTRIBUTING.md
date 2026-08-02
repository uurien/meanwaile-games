# Contributing

Thanks for considering adding a game to Meanwaile. Submissions are reviewed by hand, so a bit of care up front makes the review faster for everyone.

## Before you start

- Read the [Runtime contract](README.md#runtime-contract) and [Design constraints for submissions](README.md#design-constraints-for-submissions) in the README — these are the hard requirements a submission is checked against (pause/resume behavior, no network calls, round length, viewport).
- One PR per game. Keep unrelated changes out.

## Workflow

1. Fork the repo and create a branch.
2. Add your game under `games/your-game-id/` following the [Adding a game](README.md#adding-a-game) steps in the README (`index.html`, `game.json`, `preview.png`, plus any assets your game needs, all self-contained in that folder).
3. Add an entry for it in `collection.json` and test locally as described in [Testing locally](README.md#testing-locally).
4. Make sure your game only uses assets you have the rights to redistribute (your own work, or assets whose license permits it) — bundling third-party assets without a compatible license will block the PR.
5. Open a PR describing the game and how you tested it.

## What reviewers check

- The pause/resume contract is followed exactly (no self-managed start/pause screens, no auto-starting on load).
- No network requests, CDN scripts, or external fonts/assets.
- Round length and scope fit the "waiting-room game" format (30–90s rounds, no deep progression).
- `localStorage` keys are namespaced with the game id.
- `id`, `version`, and paths in `game.json` match the entry added to `collection.json`.

## Releasing

Releases are cut by maintainers one game at a time via the [Release game](../../actions/workflows/release-game.yml) workflow — see [Releasing a game](README.md#releasing-a-game) in the README. Contributors don't need to do anything beyond bumping `version` in their own `game.json` for future updates.
