from __future__ import annotations

from pathlib import Path
from textwrap import wrap
import math

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "image"

FONT_SANS = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_SANS_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

POSTERS = [
    ("MALO", "吗喽", "天选吗喽型", "精神状态与发疯区", "吗喽的命也是命。"),
    ("YYQZ", "仰卧起坐型废物", "间歇性踌躇满志", "精神状态与发疯区", "只要我滑跪得够快，生活的巴掌就打不到我。"),
    ("ABAA", "脑干缺失型", "纯血阿米巴原虫", "精神状态与发疯区", "啊？啥？卧槽！"),
    ("YDLH", "已读乱回大师", "赛博神经病", "精神状态与发疯区", "只要我没有逻辑，就没有人能道德绑架我。"),
    ("JDFZ", "薛定谔的疯子", "内向型暴徒", "精神状态与发疯区", "惹到我，你算是踢到棉花了。"),
    ("DXLS", "带薪拉屎冠军", "厕所驻扎者", "职场与搞钱区", "老板假装给我发工资，我就假装在工作。"),
    ("QCGG", "清澈的穷鬼", "赛博化缘师", "职场与搞钱区", "钱虽然没长在我身上，但穷病却刻在了我骨子里。"),
    ("BZY", "吸活磁铁型", "天选大怨种", "职场与搞钱区", "这活儿怎么又 TM 是我干？"),
    ("WFSG", "微服私访型", "精神董事局主席", "职场与搞钱区", "等我以后有钱了……"),
    ("TMDS", "脱敏大师", "死猪不怕开水烫", "职场与搞钱区", "随便吧，毁灭吧，赶紧的。"),
    ("NPCM", "铁血背景板", "世界的凑数者", "日常与社交区", "我连当个配角都嫌台词太多。"),
    ("HYDS", "哈哈哈敷衍仪", "社交电量极速流失者", "日常与社交区", "哈（已死）哈（想逃）哈（别说了）哈。"),
    ("FFF", "防辐射服型", "绝对防御壁垒", "日常与社交区", "智者不入爱河，寡王一路硕博。"),
    ("ZDPG", "赛博判官", "杠精祖师爷", "日常与社交区", "抛开事实不谈，难道你就没有错吗？"),
    ("KPTA", "卡皮巴拉型", "情绪阉割者", "日常与社交区", "哦，是吗，挺好的。"),
    ("DDDZ", "大动脉断裂", "究极脆皮", "健康与作息区", "医生，我还能活到下个发薪日吗？"),
    ("ZDXX", "被动修仙型", "报复性熬夜狂魔", "健康与作息区", "生前何必久睡，死后自会长眠。"),
    ("WDSS", "五毒俱全型", "赛博神农氏", "健康与作息区", "只要我不去体检，我就没病。"),
    ("BLC", "半流体生物", "床铺共生体", "健康与作息区", "站着不如坐着，坐着不如躺着。"),
    ("CTMD", "赛博活佛", "敲电子木鱼者", "健康与作息区", "佛祖保佑我今天不要骂人。"),
]

SCENE_PALETTES = {
    "精神状态与发疯区": ((25, 31, 52), (82, 86, 160), (248, 97, 84)),
    "职场与搞钱区": ((24, 49, 42), (63, 120, 92), (243, 182, 72)),
    "日常与社交区": ((54, 31, 58), (136, 83, 169), (254, 123, 142)),
    "健康与作息区": ((36, 35, 58), (74, 106, 160), (124, 212, 186)),
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


def add_shapes(image: Image.Image, code: str, accent: tuple[int, int, int], soft: tuple[int, int, int]) -> None:
    seed = code_seed(code)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = image.size

    for idx in range(6):
        radius = 110 + ((seed >> (idx * 2)) & 0x3F)
        cx = int((0.18 + (idx * 0.15)) * width) % width
        cy = int((0.12 + ((seed >> idx) & 0xFF) / 255 * 0.76) * height)
        fill = rgba(accent if idx % 2 == 0 else soft, 48 if idx % 2 == 0 else 34)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=fill)

    for idx in range(5):
        x = 80 + idx * 145
        y = height - 320 + int(math.sin((seed + idx * 17) / 37) * 40)
        draw.rounded_rectangle((x, y, x + 160, y + 16), radius=10, fill=rgba((255, 255, 255), 38))

    image.alpha_composite(overlay)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, box: tuple[int, int, int], fill: tuple[int, int, int], line_gap: int = 12) -> int:
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


def build_poster(code: str, cn: str, alias: str, scene: str, quote: str) -> Image.Image:
    width, height = 960, 1280
    bg_top, bg_bottom, accent = SCENE_PALETTES[scene]
    image = Image.new("RGBA", (width, height), bg_top + (255,))
    draw = ImageDraw.Draw(image)
    gradient_fill(draw, (width, height), bg_top, bg_bottom)

    panel = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle((56, 56, width - 56, height - 56), radius=44, fill=(255, 255, 255, 26), outline=(255, 255, 255, 60), width=2)
    image.alpha_composite(panel)

    add_shapes(image, code, accent, (255, 255, 255))
    draw = ImageDraw.Draw(image)

    code_font = load_font(FONT_SANS, 154)
    title_font = load_font(FONT_SERIF, 74)
    alias_font = load_font(FONT_SANS, 34)
    body_font = load_font(FONT_SANS_REG, 28)
    kicker_font = load_font(FONT_SANS, 26)
    quote_font = load_font(FONT_SERIF, 38)

    draw.text((92, 94), "SBTI VIRAL DOSSIER", font=kicker_font, fill=(235, 241, 255))
    draw.text((92, 142), scene, font=kicker_font, fill=accent)
    draw.text((86, 254), code, font=code_font, fill=(255, 255, 255, 92))
    draw.text((92, 462), cn, font=title_font, fill=(252, 252, 252))
    draw.text((96, 548), alias, font=alias_font, fill=(214, 224, 240))

    quote_y = draw_wrapped(draw, f"“{quote}”", quote_font, (92, 674, 760), (255, 255, 255))

    info_card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(info_card)
    card_draw.rounded_rectangle((86, quote_y + 28, width - 86, quote_y + 238), radius=32, fill=(255, 255, 255, 210))
    image.alpha_composite(info_card)

    draw = ImageDraw.Draw(image)
    draw.text((116, quote_y + 58), "截图发群建议", font=kicker_font, fill=accent)
    draw_wrapped(
        draw,
        f"{code} 属于高传播型赛博标签。适合和朋友互相对骂、互相代入、互相拉来做题。",
        body_font,
        (116, quote_y + 108, width - 232),
        (40, 46, 56),
        line_gap=10,
    )

    footer_y = height - 118
    draw.line((92, footer_y, width - 92, footer_y), fill=(255, 255, 255, 72), width=2)
    draw.text((92, footer_y + 20), "Frank x Original SBTI Fan Remake", font=kicker_font, fill=(218, 226, 238))
    draw.text((width - 320, footer_y + 20), code, font=kicker_font, fill=accent)

    return image.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for code, cn, alias, scene, quote in POSTERS:
        poster = build_poster(code, cn, alias, scene, quote)
        poster.save(OUT_DIR / f"viral-{code}.png", quality=95)
    print(f"generated {len(POSTERS)} posters in {OUT_DIR}")


if __name__ == "__main__":
    main()
