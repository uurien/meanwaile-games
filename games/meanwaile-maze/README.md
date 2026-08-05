# Meanwaile Maze

## Gameplay specification

Each round has two distinct phases:

### 1. One-time maze map

- Before movement begins, show a handmade-looking map of the current maze.
- The map must represent the maze generated for that round, not a generic or
  decorative layout.
- Clearly mark the player's starting position and the exit destination.
- Keep the map visible for ten seconds. This is the current tuning value and
  may be adjusted after playtesting.
- Once dismissed automatically, the map cannot be opened or viewed again
  during that round.

This phase is a short memorisation moment. The player should use it to form a
rough mental route rather than to study the maze indefinitely.

The paper map represents a 15×15 logical maze. Its wall lines expand into the
one-tile-thick server racks of a 31×31 physical gameplay grid (`15 × 2 + 1`).
Openings in those lines become real traversable floor tiles; there are no
decorative or fake corridor tiles.

Each round independently chooses the start and exit from the four maze
corners. They may form an adjacent or diagonal pair, but they must always be
two different corners. Candidate generation and scoring use the selected pair,
so route quality does not depend on a fixed bottom-left to top-right layout.

Maze generation produces multiple depth-first candidates and scores them before
choosing the round layout. The selected maze is always perfect: all logical
cells are connected and there is exactly one route between any pair of cells,
with no loops or shortcuts. Candidate scoring favours a long solution, at least
six decisions along that solution, and decoy branches whose ends are not
immediately visible from their junction.

### 2. Close-up exploration

- After the map disappears, switch to the playable view.
- The world must be rendered much larger than it appears on the map.
- The viewport shows only a small area of the complete maze at any one time.
- The camera follows the terminal character as it moves through the server
  racks.
- Do not expose a minimap or another way to recover the complete maze layout.

The contrast between the complete but temporary map and the restricted
close-up view is a core mechanic of the game and must be preserved in future
changes.
