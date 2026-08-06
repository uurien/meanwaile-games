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

Before the current 78×78 export, each crop was adjusted to brightness 1.55,
contrast 1.18, resized with Lanczos filtering, and sharpened by 1.8.

`map-paper-template.png` is the full-resolution RGBA source for the temporary
maze overview. It contains only the folded paper; the surrounding area is
transparent so the game can supply its own background. The maze, start and
exit markers, and countdown are intentionally absent because Phaser will draw
them from the current round state.

## Floor

`floor-resin-master.png` is the 1254×1254 source for the continuous charcoal
resin floor in `../assets/floor-resin.png`. The runtime texture is exported at
1024×1024 using Lanczos resampling and sharpness 1.15. Phaser repeats it across
viewport-sized chunks positioned in world coordinates. Each chunk starts at
the matching texture offset, so their joins remain continuous while the camera
moves every floor fragment at exactly the same rate as the racks.

`floor-resin-concept.png` preserves the approved in-context visual target. Rack
contact shadows and the rare floor grille are intentionally absent from the
texture: Phaser draws them from the generated maze so they align with the
current walls.

`floor-tiles-master.png` is the superseded five-tile blue-gray proposal. It is
kept only as design history and is no longer shipped as runtime assets.

## Character concepts

- `character-concepts-robots-humans.png` preserves the five robot and human
  explorations, each in four directions.
- `character-concepts-hoodies-segways.png` preserves the five operator, hoodie,
  and Segway explorations, each in four directions.
- `hooded-segway-four-directions.png` is the unscaled source row selected for
  the first playable character.
- `hooded-segway-chroma-master.png` preserves the high-resolution ImageGen
  background-extraction result before transparency processing.
- `hooded-segway-transparent-master.png` is the transparent high-resolution
  master used for runtime exports.

The runtime sheet is `../assets/characters/hooded-segway.png`: four transparent
64×64 frames ordered down, left, right, and up. Phaser displays them at 80% of
the 78×78 gameplay tile height.
