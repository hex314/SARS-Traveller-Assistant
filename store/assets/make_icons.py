"""生成扩展图标（16/32/48/128）与商店图标，透明背景、圆角方形。"""

from PIL import Image, ImageDraw

OUT = r"D:\Downloads\SARS-Traveller-Assistant\icons"
STORE = r"D:\Downloads\SARS-Traveller-Assistant\store"

BASE = 512  # 高分辨率绘制后缩小，边缘更平滑

# 颜色
GREEN_TOP = (26, 168, 92, 255)
GREEN_MID = (18, 137, 74, 255)
GREEN_DARK = (10, 96, 50, 255)
WHITE = (255, 255, 255, 255)
LINE = (191, 227, 206, 255)
BADGE_GREEN = (14, 124, 67, 255)


def vertical_gradient(size, stops):
    """stops: [(pos0-1, rgba), ...]"""
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        # 找到 t 所在区间
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                k = (t - p0) / (p1 - p0) if p1 > p0 else 0
                color = tuple(round(c0[j] + (c1[j] - c0[j]) * k) for j in range(4))
                break
        else:
            color = stops[-1][1]
        for x in range(w):
            px[x, y] = color
    return img


def build_icon():
    # 1. 渐变底 + 圆角蒙版（先用 alpha_composite 合成，再套蒙版）
    bg = vertical_gradient((BASE, BASE), [
        (0.0, GREEN_TOP),
        (0.55, GREEN_MID),
        (1.0, GREEN_DARK),
    ])

    sheen = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    for y in range(int(BASE * 0.55)):
        a = int(56 * (1 - y / (BASE * 0.55)))
        sd.line([(0, y), (BASE, y)], fill=(255, 255, 255, a))

    base = Image.alpha_composite(bg, sheen)

    mask = Image.new("L", (BASE, BASE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, BASE - 1, BASE - 1), radius=int(BASE * 0.23), fill=255
    )
    icon = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    icon.paste(base, (0, 0), mask)

    d = ImageDraw.Draw(icon)

    # 3. 白色申报单
    card = (int(BASE * 0.21), int(BASE * 0.145),
            int(BASE * 0.73), int(BASE * 0.82))
    d.rounded_rectangle(card, radius=int(BASE * 0.08), fill=WHITE)

    # 4. 单内浅绿线条
    for (y, w) in [(0.29, 0.33), (0.415, 0.33), (0.54, 0.21)]:
        x0 = int(BASE * 0.325)
        x1 = int(BASE * (0.325 + w))
        y0 = int(BASE * y)
        y1 = y0 + int(BASE * 0.055)
        d.rounded_rectangle((x0, y0, x1, y1), radius=int(BASE * 0.027), fill=LINE)

    # 5. 白圈 + 绿色对勾徽章
    cx, cy = int(BASE * 0.725), int(BASE * 0.735)
    r = int(BASE * 0.19)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE)
    r2 = int(r * 0.76)
    d.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), fill=BADGE_GREEN)
    # 对勾
    w = int(BASE * 0.042)
    p1 = (int(BASE * 0.652), cy + int(BASE * 0.005))
    p2 = (int(BASE * 0.702), cy + int(BASE * 0.055))
    p3 = (int(BASE * 0.792), cy - int(BASE * 0.048))
    d.line([p1, p2], fill=WHITE, width=w)
    d.line([p2, p3], fill=WHITE, width=w)
    # 端点圆头
    rr = w // 2
    for p in (p1, p2, p3):
        d.ellipse((p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr), fill=WHITE)

    return icon


def main():
    icon = build_icon()

    for size in (16, 32, 48, 128):
        small = icon.resize((size, size), Image.LANCZOS)
        path = rf"{OUT}\icon{size}.png"
        small.save(path)
        print(path)

    store_path = rf"{STORE}\icon-128.png"
    icon.resize((128, 128), Image.LANCZOS).save(store_path)
    print(store_path)


if __name__ == "__main__":
    main()
