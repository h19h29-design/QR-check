from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
RESOURCE_DIR = ROOT / "src" / "resources"
PNG_PATH = RESOURCE_DIR / "app_icon.png"
ICO_PATH = RESOURCE_DIR / "app_icon.ico"
CANVAS = 1024
SCALE = CANVAS / 256


def s(value: float) -> int:
    return round(value * SCALE)


def rounded_rect(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_gradient_background() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    pixels = image.load()
    top = (11, 83, 119)
    bottom = (18, 154, 159)
    for y in range(CANVAS):
        t = y / (CANVAS - 1)
        row = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(CANVAS):
            diagonal = max(0, min(1, (x + y) / (CANVAS * 1.9)))
            lift = round(18 * diagonal)
            pixels[x, y] = (min(row[0] + lift, 255), min(row[1] + lift, 255), min(row[2] + lift, 255), 255)
    return image


def draw_icon() -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    rounded_rect(shadow_draw, (s(20), s(24), s(236), s(240)), s(48), (0, 25, 44, 115))
    shadow = shadow.filter(ImageFilter.GaussianBlur(s(9)))
    canvas.alpha_composite(shadow)

    bg = draw_gradient_background()
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((s(18), s(18), s(238), s(238)), radius=s(46), fill=255)
    canvas.alpha_composite(Image.composite(bg, Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0)), mask))

    draw = ImageDraw.Draw(canvas)
    draw.arc((s(36), s(26), s(166), s(146)), start=188, end=334, fill=(68, 219, 210, 80), width=s(5))
    draw.arc((s(84), s(86), s(230), s(232)), start=8, end=154, fill=(255, 255, 255, 55), width=s(5))

    shield_shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shield_shadow_draw = ImageDraw.Draw(shield_shadow)
    shield = [
        (s(128), s(42)),
        (s(188), s(58)),
        (s(196), s(116)),
        (s(181), s(167)),
        (s(128), s(216)),
        (s(75), s(167)),
        (s(60), s(116)),
        (s(68), s(58)),
    ]
    shield_shadow_draw.polygon([(x + s(5), y + s(8)) for x, y in shield], fill=(0, 19, 35, 125))
    shield_shadow = shield_shadow.filter(ImageFilter.GaussianBlur(s(6)))
    canvas.alpha_composite(shield_shadow)

    draw.polygon(shield, fill=(246, 252, 255, 255), outline=(5, 45, 75, 255))
    draw.line(shield + [shield[0]], fill=(4, 68, 104, 255), width=s(7), joint="curve")

    inner = [
        (s(128), s(60)),
        (s(173), s(72)),
        (s(179), s(116)),
        (s(166), s(154)),
        (s(128), s(192)),
        (s(90), s(154)),
        (s(77), s(116)),
        (s(83), s(72)),
    ]
    draw.line(inner + [inner[0]], fill=(31, 126, 167, 90), width=s(3), joint="curve")

    qr_color = (6, 51, 84, 255)
    qr_light = (220, 245, 249, 255)
    cell = s(11)
    gap = s(4)
    start_x = s(84)
    start_y = s(88)
    pattern = [
        "1110101",
        "1010000",
        "1110111",
        "0001001",
        "1011110",
        "0010011",
        "1110101",
    ]
    rounded_rect(draw, (start_x - s(8), start_y - s(8), start_x + 7 * (cell + gap) - gap + s(8), start_y + 7 * (cell + gap) - gap + s(8)), s(12), qr_light)
    for row, line in enumerate(pattern):
        for col, bit in enumerate(line):
            if bit == "1":
                x = start_x + col * (cell + gap)
                y = start_y + row * (cell + gap)
                rounded_rect(draw, (x, y, x + cell, y + cell), s(2), qr_color)

    check_shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    check_shadow_draw = ImageDraw.Draw(check_shadow)
    check_points = [(s(98), s(154)), (s(120), s(176)), (s(166), s(118))]
    check_shadow_draw.line([(x + s(3), y + s(5)) for x, y in check_points], fill=(0, 35, 30, 90), width=s(18), joint="curve")
    check_shadow = check_shadow.filter(ImageFilter.GaussianBlur(s(2)))
    canvas.alpha_composite(check_shadow)
    draw.line(check_points, fill=(15, 166, 110, 255), width=s(20), joint="curve")
    draw.line(check_points, fill=(104, 245, 190, 255), width=s(10), joint="curve")

    draw.ellipse((s(86), s(64), s(101), s(79)), fill=(90, 230, 223, 220))
    draw.ellipse((s(103), s(55), s(111), s(63)), fill=(255, 255, 255, 190))

    return canvas.resize((256, 256), Image.Resampling.LANCZOS)


def main() -> None:
    RESOURCE_DIR.mkdir(parents=True, exist_ok=True)
    icon = draw_icon()
    icon.save(PNG_PATH)
    icon.save(ICO_PATH, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (40, 40), (32, 32), (24, 24), (20, 20), (16, 16)])
    print(f"wrote {PNG_PATH}")
    print(f"wrote {ICO_PATH}")


if __name__ == "__main__":
    main()
