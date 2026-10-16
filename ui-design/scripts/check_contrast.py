#!/usr/bin/env python3
"""Проверка контраста WCAG 2 для цветовых токенов.

Использование:
  python3 check_contrast.py "#1c2024" "#f9f9fb"             # одна пара (код выхода 1, если < --need)
  python3 check_contrast.py "#1c2024" "#f9f9fb" --need 3     # порог для крупного текста и UI
  python3 check_contrast.py page.html                        # токены из CSS, стандартные пары
  python3 check_contrast.py page.css --pair text:bg --pair border-strong:surface:3

Понимает #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (через запятые или «/ альфа»),
oklch(L C H [/ A]) (L в 0–1 или %), white, black, transparent.
Полупрозрачный цвет текста накладывается на фон, полупрозрачный фон — на --bg темы
(или на белый/чёрный), и только потом считается контраст.

В режиме файла находит обе темы, в каком бы порядке они ни были объявлены:
  · `:root{...}` — тема по умолчанию; тёмная, если внутри `color-scheme: dark`;
  · `:root[data-theme="dark"|"light"]{...}` и блоки внутри
    `@media (prefers-color-scheme: dark|light)` — вторая тема.
Без --pair проверяет пары по распространённым именам токенов (text/bg, on-accent/accent и т.д.).
Код выхода: 0 — всё прошло, 1 — есть провалы, 2 — ошибка ввода.
"""
import argparse
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
    if len(h) in (3, 4):
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


# ---------- разбор цвета с альфой ----------

NAMED = {"white": "#ffffff", "black": "#000000", "transparent": "#00000000"}
_NUM = r"([\d.]+%?)"


def _alpha(s):
    if s is None:
        return 1.0
    a = float(s[:-1]) / 100 if s.endswith("%") else float(s)
    return max(0.0, min(1.0, a))


def _to_hex(r, g, b, a=1.0):
    out = "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, round(v))) for v in (r, g, b)))
    return out if a >= 1 else out + "{:02x}".format(round(a * 255))


def parse_color(v):
    """CSS-цвет → '#rrggbb' или '#rrggbbaa' (если есть прозрачность); None, если не цвет."""
    v = v.strip().lower()
    if v in NAMED:
        return NAMED[v]
    if v.startswith("#"):
        h = v[1:]
        if not re.fullmatch(r"[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8}", h):
            return None
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h)
        return "#" + (h[:6] if h[6:] == "ff" else h)
    m = re.match(r"rgba?\(\s*" + _NUM + r"[\s,]+" + _NUM + r"[\s,]+" + _NUM + r"(?:\s*[,/]\s*" + _NUM + r")?\s*\)", v)
    if m:
        ch = [float(x[:-1]) * 2.55 if x.endswith("%") else float(x) for x in m.groups()[:3]]
        return _to_hex(*ch, _alpha(m.group(4)))
    m = re.match(r"oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*/\s*" + _NUM + r")?\s*\)", v)
    if m:
        L = float(m.group(1)) / (100 if m.group(2) else 1)
        base = oklch_to_hex(L, float(m.group(3)), float(m.group(4)))
        a = _alpha(m.group(5))
        return base if a >= 1 else base + "{:02x}".format(round(a * 255))
    return None


def alpha_of(h):
    return int(h[7:9], 16) / 255 if len(h) == 9 else 1.0


def over(fg, bg):
    """Накладывает fg (возможно полупрозрачный) на непрозрачный bg."""
    a = alpha_of(fg)
    if a >= 1:
        return fg[:7]
    f, b = hex_to_rgb(fg[:7]), hex_to_rgb(bg[:7])
    return _to_hex(*((fc * a + bc * (1 - a)) * 255 for fc, bc in zip(f, b)))


def luminance(hexcolor):
    r, g, b = (_srgb_to_lin(v) for v in hex_to_rgb(hexcolor[:7]))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg, base="#ffffff"):
    """Контраст WCAG 2. Прозрачный bg кладётся на base, прозрачный fg — на получившийся bg."""
    bg = over(bg, base)
    fg = over(fg, bg)
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

# ---------- разбор CSS ----------

def _blocks(css, selector_regex):
    return [m.group(1) for m in re.finditer(selector_regex + r"\s*\{([^{}]*)\}", css)]


def _at_rules(css):
    """(начало, конец, заголовок, тело) для каждого @-блока верхнего уровня (@media, @supports…)."""
    out = []
    for m in re.finditer(r"@[\w-]+[^{;]*\{", css):
        if out and m.start() < out[-1][1]:
            continue
        depth, i = 1, m.end()
        while i < len(css) and depth:
            depth += {"{": 1, "}": -1}.get(css[i], 0)
            i += 1
        out.append((m.start(), i, m.group(0), css[m.end():i - 1]))
    return out


def _media_blocks(css, scheme):
    """Тела `:root…{}` внутри @media (prefers-color-scheme: scheme){ … }."""
    out = []
    for _, _, head, body in _at_rules(css):
        if re.search(r"prefers-color-scheme\s*:\s*" + scheme, head):
            out += _blocks(body, r":root[^{]*")
    return out


def _top_level(css):
    """CSS без @-блоков: чтобы `:root{}` внутри @media не смешивался с темой по умолчанию."""
    for start, end, _, _ in reversed(_at_rules(css)):
        css = css[:start] + css[end:]
    return css


def tokens_from(block, base=None):
    out = dict(base or {})
    for name, val in re.findall(r"--([\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)", block.strip()):
        col = parse_color(val)
        if col:
            out[name] = col
        else:
            ref = re.match(r"var\(--([\w-]+)\s*(?:,\s*([^)]+))?\)", val.strip())
            if ref and ref.group(1) in out:
                out[name] = out[ref.group(1)]
            elif ref and ref.group(2) and parse_color(ref.group(2)):
                out[name] = parse_color(ref.group(2))
    return out


def themes_from(css):
    """{'светлая тема': tokens, 'тёмная тема': tokens} — обе темы, если они есть в файле."""
    top = _top_level(css)
    root = "".join(_blocks(top, r":root(?![\[:\w-])"))
    default_dark = bool(re.search(r"color-scheme\s*:\s*dark", root))
    base = tokens_from(root)
    themes = {("тёмная тема" if default_dark else "светлая тема"): base}
    other = "light" if default_dark else "dark"
    blocks = _blocks(top, r':root\[data-theme="?' + other + r'"?\]') or _media_blocks(css, other)
    if blocks:
        themes["светлая тема" if default_dark else "тёмная тема"] = tokens_from("".join(blocks), base)
    return themes


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


def check(tokens, pairs, label, dark=False):
    fails = 0
    page = over(tokens.get("bg", "#000000" if dark else "#ffffff"), "#000000" if dark else "#ffffff")
    print(f"\n[{label}]")
    for fg, bg, need in pairs:
        if fg not in tokens or bg not in tokens:
            continue
        c = contrast(tokens[fg], tokens[bg], page)
        ok = c >= need
        fails += not ok
        print(f"  {'OK  ' if ok else 'FAIL'} {fg:>14} on {bg:<14} {c:5.2f}:1 (нужно {need:g})")
    return fails


def _pair(s):
    parts = s.split(":")
    if len(parts) not in (2, 3) or not all(parts[:2]):
        raise argparse.ArgumentTypeError(f"ожидается fg:bg или fg:bg:порог, получено «{s}»")
    try:
        need = float(parts[2]) if len(parts) == 3 else 4.5
    except ValueError:
        raise argparse.ArgumentTypeError(f"порог должен быть числом: «{parts[2]}»")
    return parts[0], parts[1], need


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("inputs", nargs="+", metavar="ЦВЕТ_ИЛИ_ФАЙЛ", help="два цвета (текст и фон) или путь к CSS/HTML")
    p.add_argument("--pair", action="append", type=_pair, default=[], metavar="FG:BG[:ПОРОГ]",
                   help="пара токенов для проверки (по умолчанию порог 4.5); можно несколько раз")
    p.add_argument("--need", type=float, default=4.5, help="порог для режима пары (4.5 текст, 3 крупный текст и UI, 7 AAA)")
    a = p.parse_args(argv)

    if len(a.inputs) == 2:
        fg, bg = parse_color(a.inputs[0]), parse_color(a.inputs[1])
        bad = [s for s, c in zip(a.inputs, (fg, bg)) if c is None]
        if bad:
            print(f"Не понимаю цвет: {', '.join(bad)}. Нужен #rgb, #rrggbb, rgb(), oklch() или white/black.", file=sys.stderr)
            return 2
        c = contrast(fg, bg)
        note = " (прозрачный фон наложен на белый)" if alpha_of(bg) < 1 else ""
        print(f"{fg} on {bg}: {c:.2f}:1{note}  текст AA {'OK' if c >= 4.5 else 'FAIL'} · "
              f"крупный/UI {'OK' if c >= 3 else 'FAIL'} · AAA {'OK' if c >= 7 else 'FAIL'}")
        return 0 if c >= a.need else 1
    if len(a.inputs) != 1:
        p.error("нужен один файл или два цвета")

    try:
        with open(a.inputs[0], encoding="utf-8-sig") as f:
            css = f.read()
    except OSError as e:
        print(f"Не могу открыть файл: {e}", file=sys.stderr)
        return 2
    themes = themes_from(css)
    if not any(themes.values()):
        print("В файле не найдено цветовых токенов в :root{...}.", file=sys.stderr)
        return 2
    pairs = a.pair or DEFAULT_PAIRS
    fails = sum(check(t, pairs, label, dark=label.startswith("тёмн")) for label, t in themes.items())
    if len(themes) == 1:
        print("\nВторая тема не найдена (нет :root[data-theme=…] и @media prefers-color-scheme).")
    print(f"\nИтого провалов: {fails}")
    return 1 if fails else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main(sys.argv[1:]))
