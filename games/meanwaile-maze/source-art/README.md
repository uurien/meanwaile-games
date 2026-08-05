# Rack tile source artwork

`rack-tiles-master.png` is the original 1536×1024 image used to create the ten
runtime rack tiles in `../assets/racks/`. Keep it at full resolution so the
tiles can be regenerated at a different size without upscaling an existing
game asset.

The five variants use these horizontal crop ranges, from left to right:

```text
(24, 313), (333, 609), (627, 905), (923, 1199), (1219, 1504)
```

The vertical crop ranges are:

```text
floor-below: (98, 439)
rack-below:  (581, 914)
```

Before the current 26×26 export, each crop was adjusted to brightness 1.55,
contrast 1.18, resized with Lanczos filtering, and sharpened by 1.8.

`map-paper-template.png` is the full-resolution RGBA source for the temporary
maze overview. It contains only the folded paper; the surrounding area is
transparent so the game can supply its own background. The maze, start and
exit markers, and countdown are intentionally absent because Phaser will draw
them from the current round state.
