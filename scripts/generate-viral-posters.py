from __future__ import annotations

import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
OUT_DIR = ROOT / "image"

FONT_SANS = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_SANS_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

SCENE_PALETTES = {
    "精神内耗区": ((25, 27, 47), (75, 83, 160), (255, 104, 87)),
    "职场求生区": ((19, 41, 39), (42, 109, 92), (255, 196, 94)),
    "爆鸣输出区": ((58, 19, 28), (157, 42, 56), (255, 148, 84)),
    "赛博修佛区": ((36, 34, 58), (85, 95, 156), (149, 223, 196)),
    "社交伪装区": ((44, 32, 67), (128, 83, 160), (255, 164, 188)),
    "摆烂逃生区": ((41, 45, 52), (95, 106, 121), (178, 196, 160)),
    "续命脆皮区": ((44, 24, 30), (129, 71, 83), (255, 180, 144)),
    "社交放电区": ((70, 36, 48), (182, 88, 120), (255, 205, 108)),
    "边界潜逃区": ((22, 36, 58), (67, 111, 158), (154, 203, 255)),
    "邪门效率区": ((53, 26, 38), (132, 54, 84), (233, 188, 86)),
}


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def gradient_fill(draw: ImageDraw.ImageDraw, size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    width, height = size
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(lerp(top[i], bottom[i], t) for i in range(3))
        draw.line((0, y, width, y), fill=color)


def code_seed(code: str) -> int:
    seed = 0
    for ch in code:
        seed = (seed * 131 + ord(ch)) & 0xFFFFFFFF
    return seed


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color + (alpha,)


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    box: tuple[int, int, int],
    fill: tuple[int, int, int],
    line_gap: int = 12,
) -> int:
    x, y, max_width = box
    line = ""
    for char in text:
        test = line + char
        width = draw.textbbox((0, 0), test, font=font)[2]
        if width > max_width and line:
            draw.text((x, y), line, font=font, fill=fill)
            y += font.size + line_gap
            line = char
        else:
            line = test
    if line:
        draw.text((x, y), line, font=font, fill=fill)
        y += font.size + line_gap
    return y


def add_shapes(image: Image.Image, code: str, accent: tuple[int, int, int]) -> None:
    width, height = image.size
    seed = code_seed(code)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for idx in range(8):
        radius = 90 + ((seed >> (idx * 2)) & 0x5F)
        cx = int((0.12 + idx * 0.11) * width) % width
        cy = int((0.08 + ((seed >> idx) & 0xFF) / 255 * 0.74) * height)
        fill = rgba(accent, 34 if idx % 2 == 0 else 22)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=fill)

    for idx in range(6):
        x = 84 + idx * 128
        y = height - 380 + int(math.sin((seed + idx * 29) / 33) * 44)
        draw.rounded_rectangle((x, y, x + 160, y + 16), radius=12, fill=rgba((255, 255, 255), 38))

    draw.arc((width - 420, 110, width - 60, 470), start=210, end=18, fill=rgba(accent, 90), width=8)
    image.alpha_composite(overlay)


def load_archetypes() -> list[dict[str, object]]:
    text = INDEX_HTML.read_text(encoding="utf-8")
    match = re.search(r"const VIRAL_ARCHETYPES = (\[.*?\]);\s+const VIRAL_BY_CODE", text, re.S)
    if not match:
        raise RuntimeError("Could not locate VIRAL_ARCHETYPES in index.html")
    return json.loads(match.group(1))


def build_poster(item: dict[str, object]) -> Image.Image:
    code = str(item["code"])
    cn = str(item["cn"])
    alias = str(item["alias"])
    scene = str(item["scene"])
    quote = str(item["quote"])
    symptom = str(item["symptom"])
    advice = str(item["advice"])

    width, height = 960, 1280
    bg_top, bg_bottom, accent = SCENE_PALETTES.get(scene, ((29, 33, 54), (95, 98, 172), (255, 172, 96)))
    image = Image.new("RGBA", (width, height), bg_top + (255,))
    draw = ImageDraw.Draw(image)
    gradient_fill(draw, (width, height), bg_top, bg_bottom)

    glass = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glass_draw = ImageDraw.Draw(glass)
    glass_draw.rounded_rectangle((52, 52, width - 52, height - 52), radius=42, fill=(255, 255, 255, 20), outline=(255, 255, 255, 56), width=2)
    glass_draw.rounded_rectangle((84, 604, width - 84, height - 170), radius=34, fill=(7, 10, 18, 92), outline=(255, 255, 255, 18), width=2)
    image.alpha_composite(glass)

    add_shapes(image, code, accent)
    draw = ImageDraw.Draw(image)

    kicker_font = load_font(FONT_SANS, 26)
    code_font = load_font(FONT_SANS, 144)
    title_font = load_font(FONT_SERIF, 68)
    alias_font = load_font(FONT_SANS, 32)
    body_font = load_font(FONT_SANS_REG, 27)
    quote_font = load_font(FONT_SERIF, 34)
    badge_font = load_font(FONT_SANS, 24)

    draw.text((90, 90), "CYBER MELTDOWN DOSSIER", font=kicker_font, fill=(235, 242, 255))
    draw.text((90, 132), scene, font=kicker_font, fill=accent)
    draw.text((84, 240), code, font=code_font, fill=(255, 255, 255, 88))
    draw.text((90, 430), cn, font=title_font, fill=(252, 252, 252))
    draw.text((94, 514), alias, font=alias_font, fill=(223, 230, 243))

    quote_y = draw_wrapped(draw, f"“{quote}”", quote_font, (92, 646, 760), (255, 255, 255), line_gap=12)

    badge_y = quote_y + 34
    badge_text = f"主症状 / {scene}"
    badge_width = draw.textbbox((0, 0), badge_text, font=badge_font)[2] + 36
    draw.rounded_rectangle((92, badge_y, 92 + badge_width, badge_y + 42), radius=21, fill=rgba(accent, 188))
    draw.text((110, badge_y + 7), badge_text, font=badge_font, fill=(18, 22, 28))

    body_y = badge_y + 68
    body_y = draw_wrapped(draw, symptom, body_font, (104, body_y, width - 220), (234, 239, 247), line_gap=10)

    advice_y = body_y + 22
    draw.text((104, advice_y), "赛博医嘱", font=kicker_font, fill=accent)
    draw_wrapped(draw, advice, body_font, (104, advice_y + 42, width - 220), (234, 239, 247), line_gap=10)

    footer_y = height - 122
    draw.line((92, footer_y, width - 92, footer_y), fill=(255, 255, 255, 70), width=2)
    draw.text((92, footer_y + 20), "Frank x Original SBTI Fan Remake", font=kicker_font, fill=(219, 226, 236))
    draw.text((width - 220, footer_y + 20), code, font=kicker_font, fill=accent)

    return image.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    posters = load_archetypes()
    for item in posters:
        poster = build_poster(item)
        poster.save(OUT_DIR / f"viral-{item['code']}.png", quality=95)
    print(f"generated {len(posters)} posters in {OUT_DIR}")


if __name__ == "__main__":
    main()
