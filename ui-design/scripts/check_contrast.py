#!/usr/bin/env python3
"""Проверка контраста WCAG 2 для цветовых токенов.

Использование:
  python3 check_contrast.py "#1c2024" "#f9f9fb"             # одна пара
  python3 check_contrast.py page.html                        # токены из CSS, стандартные пары
  python3 check_contrast.py page.css --pair text:bg --pair on-accent:accent

Понимает #rgb, #rrggbb, rgb(), oklch(L C H) (L в 0–1 или %).
В режиме файла читает токены из `:root{...}` (светлая тема) и из блока
`:root[data-theme="dark"]{...}` (тёмная). Без --pair проверяет пары по
распространённым именам токенов (text/bg, text-2/bg, on-accent/accent и т.д.).
"""
import math
import re
import sys

# ---------- преобразования цвета ----------

def _srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def oklch_to_linear_rgb(L, C, H):
    a = C * math.cos(math.radians(H))
    b = C * math.sin(math.radians(H))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return r, g, bb


def in_gamut(L, C, H, eps=1e-4):
    return all(-eps <= v <= 1 + eps for v in oklch_to_linear_rgb(L, C, H))


def oklch_to_hex(L, C, H):
    """OKLCH → hex; хрома уменьшается, пока цвет не войдёт в sRGB."""
    while C > 0 and not in_gamut(L, C, H):
        C = max(0.0, C - 0.002)
    r, g, b = (round(_lin_to_srgb(v) * 255) for v in oklch_to_linear_rgb(L, C, H))
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def hex_to_oklch(h):
    r, g, b = (_srgb_to_lin(v) for v in hex_to_rgb(h))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    C = math.hypot(a, bb)
    H = math.degrees(math.atan2(bb, a)) % 360
    return L, C, H


def parse_color(v):
    v = v.strip().lower()
    if v.startswith("#"):
        return v if len(v) == 7 else "#" + "".join(ch * 2 for ch in v[1:4])
    m = re.match(r"rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)", v)
    if m:
        return "#{:02x}{:02x}{:02x}".format(*(round(float(x)) for x in m.groups()))
    m = re.match(r"oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)", v)
    if m:
        L = float(m.group(1)) / (100 if m.group(2) else 1)
        return oklch_to_hex(L, float(m.group(3)), float(m.group(4)))
    return None


def luminance(hexcolor):
    r, g, b = (_srgb_to_lin(v) for v in hex_to_rgb(hexcolor))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

# ---------- разбор CSS ----------

def _block(css, selector_regex):
    m = re.search(selector_regex + r"\s*\{([^{}]*)\}", css)
    return m.group(1) if m else ""


def tokens_from(block, base=None):
    out = dict(base or {})
    for name, val in re.findall(r"--([\w-]+)\s*:\s*([^;]+);", block):
        col = parse_color(val)
        if col:
            out[name] = col
        else:
            ref = re.match(r"var\(--([\w-]+)\)", val.strip())
            if ref and ref.group(1) in out:
                out[name] = out[ref.group(1)]
    return out


DEFAULT_PAIRS = [
    ("text", "bg", 4.5), ("text", "surface", 4.5),
    ("text-2", "bg", 4.5), ("text-2", "surface", 4.5),
    ("on-accent", "accent", 4.5), ("on-accent", "accent-hover", 4.5),
    ("accent-text", "bg", 4.5), ("accent-text", "surface", 4.5),
    ("accent-text", "accent-soft", 4.5),
    ("border-strong", "surface", 3.0), ("focus", "bg", 3.0),
    ("success", "surface", 4.5), ("success", "success-soft", 4.5),
    ("warning", "surface", 4.5), ("warning", "warning-soft", 4.5),
    ("danger", "surface", 4.5), ("danger", "danger-soft", 4.5),
]


def check(tokens, pairs, label):
    fails = 0
    print(f"\n[{label}]")
    for fg, bg, need in pairs:
        if fg not in tokens or bg not in tokens:
            continue
        c = contrast(tokens[fg], tokens[bg])
        ok = c >= need
        fails += not ok
        print(f"  {'OK ' if ok else 'FAIL'} {fg:>14} on {bg:<14} {c:5.2f}:1 (нужно {need})")
    return fails


def main(argv):
    if len(argv) >= 2 and argv[0].startswith(("#", "rgb", "oklch")):
        fg, bg = parse_color(argv[0]), parse_color(argv[1])
        c = contrast(fg, bg)
        print(f"{fg} on {bg}: {c:.2f}:1  текст AA {'OK' if c >= 4.5 else 'FAIL'} · крупный/UI {'OK' if c >= 3 else 'FAIL'}")
        return 0
    if not argv:
        print(__doc__)
        return 1
    css = open(argv[0], encoding="utf-8").read()
    pairs = []
    for i, a in enumerate(argv):
        if a == "--pair" and i + 1 < len(argv):
            fg, bg = argv[i + 1].split(":")
            pairs.append((fg, bg, 4.5))
    pairs = pairs or DEFAULT_PAIRS
    light = tokens_from(_block(css, r":root(?![\[:])"))
    dark_block = _block(css, r':root\[data-theme="dark"\]')
    fails = check(light, pairs, "светлая тема")
    if dark_block:
        fails += check(tokens_from(dark_block, light), pairs, "тёмная тема")
    print(f"\nИтого провалов: {fails}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
