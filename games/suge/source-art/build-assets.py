"""Export the generated Suge artwork into compact runtime assets."""

from pathlib import Path

from PIL import Image


SOURCE_DIR = Path(__file__).resolve().parent
ASSET_DIR = SOURCE_DIR.parent / "assets"
ATLAS_COLUMNS = 4
ATLAS_ROWS = 2
CELL_SIZE = 256
SPRITE_MAX_SIZE = 216


def remove_magenta_fringe(image: Image.Image) -> Image.Image:
    """Drop the last chroma-key pixels without desaturating the artwork."""

    rgba = image.convert("RGBA")
    cleaned = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        is_key_fringe = min(red, blue) > 180 and min(red, blue) - green > 100
        cleaned.append((red, green, blue, 0 if is_key_fringe else alpha))
    rgba.putdata(cleaned)
    return rgba


def export_prey_atlas() -> None:
    source = remove_magenta_fringe(
        Image.open(SOURCE_DIR / "prey-atlas-transparent-master.png")
    )
    output = Image.new(
        "RGBA",
        (ATLAS_COLUMNS * CELL_SIZE, ATLAS_ROWS * CELL_SIZE),
        (0, 0, 0, 0),
    )

    for row in range(ATLAS_ROWS):
        for column in range(ATLAS_COLUMNS):
            left = round(column * source.width / ATLAS_COLUMNS)
            top = round(row * source.height / ATLAS_ROWS)
            right = round((column + 1) * source.width / ATLAS_COLUMNS)
            bottom = round((row + 1) * source.height / ATLAS_ROWS)
            sprite = source.crop((left, top, right, bottom))
            bounds = sprite.getchannel("A").getbbox()
            if bounds is None:
                raise RuntimeError(f"No sprite found in atlas slot {column},{row}")
            sprite = sprite.crop(bounds)
            sprite.thumbnail(
                (SPRITE_MAX_SIZE, SPRITE_MAX_SIZE),
                Image.Resampling.LANCZOS,
            )

            target_x = column * CELL_SIZE + (CELL_SIZE - sprite.width) // 2
            target_y = row * CELL_SIZE + (CELL_SIZE - sprite.height) // 2
            output.alpha_composite(sprite, (target_x, target_y))

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    output.save(ASSET_DIR / "prey-atlas.png", optimize=True)


def export_paper_texture() -> None:
    paper = Image.open(SOURCE_DIR / "paper-texture-master.png").convert("RGB")
    paper = paper.resize((768, 768), Image.Resampling.LANCZOS)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    paper.save(ASSET_DIR / "paper-texture.png", optimize=True)


if __name__ == "__main__":
    export_prey_atlas()
    export_paper_texture()
