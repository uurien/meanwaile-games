# Suge source artwork

The runtime artwork in `../assets/` was generated for Suge with the built-in
OpenAI image-generation tool. The supplied game drawing established the warm
paper, graphite and softly scribbled colored-pencil direction.

## Prey atlas

`prey-atlas-chroma-master.png` is the generated master. The exact prompt was:

> Use case: stylized-concept. Asset type: game sprite atlas master for the Suge
> snake game. Use the current Suge preview as the exact reference for
> paper-sketch linework, scale, muted color, and handmade character. Create
> exactly eight cute small-animal prey sprites in a 4-column by 2-row atlas.
> Top row: gray field mouse, green frog, ochre-and-green lizard/gecko, yellow
> chick. Bottom row: dark teal beetle, brown snail, blue-gray fish, pinkish
> earthworm. Use naïve graphite and softly scribbled colored pencil, irregular
> doubled contours, muted warm colors, and a uniform #ff00ff chroma-key
> background. Every animal must remain recognizable at about 24 pixels. No
> violence, gore, attack scene, labels, dividers, text, shadows, emoji styling,
> glossy 3D rendering, vector smoothness, extra objects, or watermark.

The imagegen skill's `remove_chroma_key.py` helper produced
`prey-atlas-transparent-master.png`. `build-assets.py` crops each slot,
normalizes it into a 256×256 cell, removes residual magenta edge pixels, and
writes the 1024×512 RGBA runtime atlas.

## Paper

`paper-texture-master.png` is the generated master. The exact prompt was:

> Use case: stylized-concept. Asset type: seamless-feeling game background
> texture for Suge. Use the warm fibrous paper in the supplied hand-drawn
> reference as the material reference. Create a clean square sheet of warm
> ivory handmade drawing paper only: subtle natural fibers, faint graphite
> dust, gentle uneven cream tone, flat scan-like lighting, uniform detail and
> naturally blending opposite edges. No objects, border, vignette, folds,
> stains, dramatic grain, directional light, text, or watermark.

`build-assets.py` downsamples the master to the 768×768 RGB runtime texture.

Run the export from this directory with Python 3 and Pillow installed:

```sh
python3 build-assets.py
```
