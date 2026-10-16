#!/usr/bin/env python3
"""Варианты стиля (style tiles) из собственных систем и экспорт выбранной.

Шаблонов нет: для каждого брифа агент сам выводит параметры по references/23
(размеры, шкала, отступы, радиусы, цвет, глубина, движение) и записывает их
с причинами в system.json. Скрипт рисует варианты рядом, проверяет их и экспортирует
выбранный в design-system.css + DESIGN.md.

  python3 style_tiles.py a.json b.json c.json -o tiles.html        # 2–3 варианта рядом
  python3 style_tiles.py a.json b.json --embed-fonts ./fonts -o t.html   # шрифты внутрь (офлайн)
  python3 style_tiles.py --check a.json                            # только проверка
  python3 style_tiles.py --export a.json -d ./design               # design-system.css, DESIGN.md, tokens.json, tailwind.css

Схема system.json — references/23, раздел 8; пример — assets/styles/system.example.json.
"""
import argparse, base64, json, os, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_palette import build, neutral_for_hue, NEUTRALS, ORDER, BG_KINDS  # noqa: E402
from check_contrast import hex_to_rgb  # noqa: E402

ROOT = os.path.join(HERE, "..")
ICONS = json.load(open(os.path.join(ROOT, "assets", "icons", "icons.json"), encoding="utf-8"))["icons"]

# Шрифты Google Fonts с кириллицей (проверено по fontsource) и доступные начертания.
WEIGHTS = {
    "Unbounded": "400;600;700;800", "Onest": "400;500;600;700", "Playfair Display": "400;600;700;800",
    "Source Sans 3": "400;600;700", "Lora": "400;500;600;700", "Golos Text": "400;500;600;700",
    "Manrope": "400;500;600;700;800", "Comfortaa": "400;600;700", "Nunito": "400;600;700;800",
    "PT Serif": "400;700", "PT Sans": "400;700", "Russo One": "400", "Exo 2": "400;500;600;700",
    "IBM Plex Sans": "400;500;600;700", "IBM Plex Mono": "400;500;600", "Prata": "400", "Jost": "400;500;600",
    "Rubik": "400;500;700;800", "Commissioner": "400;600;800", "Cormorant Garamond": "400;600;700",
    "Mulish": "400;600;700", "Geologica": "400;600;700", "Fira Sans": "400;500;600;700", "JetBrains Mono": "400;600",
    "Inter": "400;500;600;700",
}
FIELDS = ("outline", "filled", "underline", "pill")
MOTION = {
    "minimal": {"dur": "120ms", "label": "Минимальный: отклик, состояния, загрузка — официальные продукты"},
    "restrained": {"dur": "160ms", "label": "Сдержанный: фейды и смена цвета"},
    "productive": {"dur": "220ms", "label": "Продуктовый: весь минимум слоя движения"},
    "expressive": {"dur": "320ms", "label": "Выразительный: крупные сдвиги, частицы, зум"},
}
DEPTH = {
    "flat":     {"card": "none", "pop": "0 12px 32px -16px rgb(0 0 0 / .25)", "line": "var(--border)", "ctrl": "var(--border-strong)",
                 "label": "Без теней: разделение фоном и рамками"},
    "soft":     {"card": "0 1px 2px rgb(0 0 0 / .05), 0 8px 24px -12px rgb(0 0 0 / .14)", "pop": "0 16px 40px -16px rgb(0 0 0 / .28)",
                 "line": "transparent", "ctrl": "var(--border-strong)", "label": "Мягкие двойные тени"},
    "hard":     {"card": "4px 4px 0 var(--text)", "pop": "6px 6px 0 var(--text)", "line": "var(--text)", "ctrl": "var(--text)",
                 "label": "Жёсткая смещённая тень и толстая рамка"},
    "glow":     {"card": "0 0 0 1px var(--border), 0 0 28px -10px var(--accent)", "pop": "0 0 32px -6px var(--accent)",
                 "line": "transparent", "ctrl": "var(--border-strong)", "label": "Свечение акцентом (тёмные темы)"},
    "hairline": {"card": "none", "pop": "0 12px 32px -16px rgb(0 0 0 / .25)", "line": "var(--border)", "ctrl": "var(--border-strong)",
                 "label": "Тонкие линии, много воздуха"},
}
SAMPLE = {"brand": "Продукт", "nav": ["Обзор", "Платежи"], "eyebrow": "Раздел", "title": "Главный заголовок экрана",
          "lead": "Короткий подзаголовок объясняет пользу в одной-двух строках.", "primary": "Главное действие",
          "secondary": "Подробнее", "tertiary": "Ещё", "kpi_label": "Показатель", "kpi": "248 500 ₸", "delta": "+2 140 ₸",
          "field": "Поле ввода", "value": "10 000 ₸", "chips": ["Готово", "В процессе", "Ошибка", "Метка"],
          "icons": ["house", "wallet", "chart-column", "bell", "settings", "shield-check"]}


class SpecError(Exception):
    pass


def load(path):
    try:
        with open(path, encoding="utf-8-sig") as f:   # utf-8-sig: Блокнот и PowerShell пишут JSON с BOM
            s = json.load(f)
    except OSError as e:
        raise SpecError(f"{path}: не могу открыть ({e.strerror})")
    except json.JSONDecodeError as e:
        raise SpecError(f"{path}: неверный JSON — строка {e.lineno}, столбец {e.colno}: {e.msg}")
    missing = [k for k in ("color", "type", "space", "shape") if k not in s]
    if missing:
        raise SpecError(f"{path}: нет разделов {', '.join(missing)} (схема — references/23, раздел 8)")
    for sect, keys in (("color", ["hue"]), ("type", ["body", "base", "ratio"]), ("space", ["scale", "control"]), ("shape", ["radius"])):
        lost = [k for k in keys if k not in s[sect]]
        if lost:
            raise SpecError(f"{path}: в {sect} нет {', '.join(lost)}")
    if s["color"].get("bg", "tinted") not in BG_KINDS:
        raise SpecError(f"{path}: color.bg «{s['color'].get('bg')}» — нужно одно из {', '.join(BG_KINDS)}")
    if not 0 <= s["color"].get("tint", 0) <= 1:
        raise SpecError(f"{path}: color.tint — от 0 до 1")
    field = s["shape"].get("field", "outline")
    if field not in FIELDS:
        raise SpecError(f"{path}: shape.field «{field}» — нужно одно из {', '.join(FIELDS)}")
    depth = s.get("depth", {}).get("style", "soft")
    if depth not in DEPTH:
        raise SpecError(f"{path}: depth.style «{depth}» — нужно одно из {', '.join(DEPTH)}")
    motion = s.get("motion", {}).get("level", "productive")
    if motion not in MOTION:
        raise SpecError(f"{path}: motion.level «{motion}» — нужно одно из {', '.join(MOTION)}")
    s.setdefault("name", os.path.splitext(os.path.basename(path))[0])
    s["_key"] = os.path.splitext(os.path.basename(path))[0]
    return resolve(s)


def resolve(s):
    c, t, sp, sh = s["color"], s["type"], s["space"], s["shape"]
    neutral = c.get("neutral", "auto")
    neutral = neutral_for_hue(c["hue"]) if neutral in (None, "auto") else neutral
    s["_neutral"] = neutral
    s["_colors"] = build(c["hue"], c.get("chroma", 0.12), neutral, c.get("accent_l", 0.62), c.get("bright", False),
                         c.get("bg", "tinted"), c.get("tint", 0.0))
    s["_dark_first"] = c.get("dark_first", False)
    t.setdefault("display", t["body"]); t.setdefault("display_weight", 700); t.setdefault("body_weight", 400)
    t.setdefault("line", 1.5); t.setdefault("heading_line", 1.15); t.setdefault("display_max", 56)
    s["_type"] = t
    sh.setdefault("button", "rect"); sh.setdefault("border", 1)
    s["_depth"] = DEPTH[s.get("depth", {}).get("style", "soft")]
    s["_motion"] = MOTION[s.get("motion", {}).get("level", "productive")]
    s["_sample"] = {**SAMPLE, **s.get("sample", {})}
    return s


def sizes(t):
    b, k = t["base"], t["ratio"]
    f = lambda n: round(b * k ** n)
    return {"sm": max(12, f(-1)), "base": b, "lg": f(1), "h3": f(2), "h2": f(3), "h1": f(4), "display": min(t["display_max"], max(f(4), f(6)))}


def check(s):
    """Предупреждения: пустые причины, нарушения пропорций из references/23."""
    w = []
    for part in ("color", "type", "space", "shape", "depth", "motion"):
        if not str(s.get(part, {}).get("why", "")).strip():
            w.append(f"{part}.why пустое — запиши, почему выбрано это значение")
    t, sz, sp, sh, c = s["_type"], sizes(s["_type"]), s["space"], s["shape"], s["color"]
    if t["base"] < 12: w.append("база меньше 12 px")
    if sz["h1"] / t["base"] < 1.6: w.append(f"H1 всего в {sz['h1'] / t['base']:.2f}× крупнее текста — иерархия не читается (нужно ≥ 1.6)")
    if not 1.1 <= t["ratio"] <= 1.7: w.append("коэффициент шкалы вне 1.1–1.7")
    if t["line"] < 1.35: w.append("межстрочный текста < 1.35")
    if t["heading_line"] > 1.35: w.append("межстрочный заголовков > 1.35 — строки распадаются")
    for f in {t["body"], t["display"], t.get("mono") or t["body"]}:
        if f not in WEIGHTS: w.append(f"шрифт «{f}» не из проверенного списка — сам проверь кириллицу, казахские буквы и ₸")
    if sp["control"] >= 52 and t["base"] < 18:
        w.append(f"контрол {sp['control']} px при тексте {t['base']} px — крупные поля нужны для 55+, киосков и крупных CTA; для обычного продукта выведи высоту из плотности")
    if sp["control"] < 24: w.append("контрол меньше 24 px (WCAG 2.5.8)")
    elif sp["control"] < 40: w.append(f"контрол {sp['control']} px — только для плотных десктопных интерфейсов; на мобильном ≥ 44")
    sc = sp["scale"]
    if any(b <= a for a, b in zip(sc, sc[1:])): w.append("шкала отступов не возрастает")
    if any(b / a < 1.2 for a, b in zip(sc[2:], sc[3:])): w.append("соседние шаги отступов отличаются < 20% — неразличимы")
    r = sh["radius"]
    if len(r) != 3: w.append("shape.radius — три значения: малый, средний (кнопки и поля), крупный (карточки)")
    elif sh["button"] == "rect" and r[1] > sp["control"] / 3: w.append(f"радиус {r[1]} больше h/3 — либо сделай pill, либо уменьши")
    h = c["hue"] % 360
    if 260 <= h <= 295 and not c.get("brand"):
        w.append("индиго-фиолетовый — самый шаблонный тон; оставь, только если причина в бренде (color.brand: true)")
    elif 180 <= h <= 250 and c.get("chroma", 0.12) >= 0.09 and not c.get("brand"):
        w.append("бирюза и синий — перегруженные семьи; убедись, что причина в why не «надёжно и спокойно» по привычке")
    if (h >= 325 or h < 10) and c.get("chroma", 0.12) <= 0.13 and not c.get("bright") and c.get("accent_l", 0.62) <= 0.5 and not c.get("brand"):
        w.append("тёмная приглушённая слива или ягода — частый выбор «по привычке»; убедись, что тон и приглушённость следуют из брифа")
    if c.get("neutral") in (None, "auto"): w.append("нейтраль выбрана автоматически — реши температуру сам (slate, sand, sage, olive, mauve, gray)")
    return w


def distinct(a, b):
    """Сколько из 6 признаков палитры различаются (references/23, «Как не повторяться»)."""
    fam = lambda h: int(((h + 15) % 360) // 30)
    ca, cb = a["color"], b["color"]
    band = lambda x: 0 if x < 0.09 else 1 if x < 0.14 else 2
    return sum([fam(ca["hue"]) != fam(cb["hue"]), band(ca.get("chroma", .12)) != band(cb.get("chroma", .12)),
                a["_neutral"] != b["_neutral"], a["_dark_first"] != b["_dark_first"],
                bool(ca.get("bright")) != bool(cb.get("bright")),
                (ca.get("bg", "tinted"), ca.get("tint", 0) > 0) != (cb.get("bg", "tinted"), cb.get("tint", 0) > 0)])


def fonts(r):
    t = r["_type"]; out = []
    for f in [t["display"], t["body"], t.get("mono")]:
        if f and f not in out: out.append(f)
    return out


def font_links(families):
    out = ['<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>']
    for f in families:
        out.append(f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={f.replace(" ", "+")}:wght@{WEIGHTS.get(f, "400;700")}&display=swap">')
    return "\n".join(out)

def embed_fonts(families, wanted, fonts_dir):
    """@font-face с base64 из пакетов fontsource (npm i @fontsource/<имя>): страница работает офлайн."""
    out = []
    for f in families:
        slug = f.lower().replace(" ", "-")
        for w in wanted.get(f, ["400", "700"]):
            for sub, rng in (("cyrillic", "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116"),
                             ("cyrillic-ext", "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F"),
                             ("latin", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+20B8,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD")):
                fp = os.path.join(fonts_dir, "node_modules", "@fontsource", slug, "files", f"{slug}-{sub}-{w}-normal.woff2")
                if os.path.exists(fp):
                    b = base64.b64encode(open(fp, "rb").read()).decode()
                    out.append(f'@font-face{{font-family:"{f}";font-style:normal;font-weight:{w};font-display:swap;'
                               f'src:url(data:font/woff2;base64,{b}) format("woff2");unicode-range:{rng};}}')
    return "\n".join(out)


def used_weights(specs):
    """Какие начертания реально нужны: тело 400/600, заголовок — его вес, моно 400."""
    w = {}
    def add(f, *ws):
        avail = WEIGHTS.get(f, "400;700").split(";")
        for x in ws:
            x = str(x) if str(x) in avail else min(avail, key=lambda a: abs(int(a) - int(x)))
            w.setdefault(f, []); x not in w[f] and w[f].append(x)
    for r in specs:
        t = r["_type"]
        add(t["body"], 400, 600); add(t["display"], t["display_weight"])
        if t.get("mono"): add(t["mono"], 400)
    return w


def rem(px):
    """px → rem при базе браузера 16 px: размеры шрифта в rem уважают системную настройку размера текста."""
    return f"{round(px / 16, 4):g}rem"


def tokens(r, theme):
    c = r["_colors"][theme]; t = r["_type"]; sz = sizes(t); sp = r["space"]; sh = r["shape"]; d = r["_depth"]
    lines = [f"--{k}: {c[k]};" for k in ORDER]
    mono = t.get("mono") or "ui-monospace"
    lines += [
        f'--font-display: "{t["display"]}", system-ui, sans-serif;',
        f'--font-body: "{t["body"]}", system-ui, -apple-system, "Segoe UI", sans-serif;',
        f'--font-mono: "{mono}", ui-monospace, Menlo, monospace;',
        f'--display-weight: {t["display_weight"]}; --body-weight: {t["body_weight"]};',
        *[f"--fs-{k}: {rem(v)};" for k, v in sz.items()],
        f'--lh-body: {t["line"]}; --lh-heading: {t["heading_line"]};',
        *[f"--space-{i + 1}: {v}px;" for i, v in enumerate(sp["scale"])],
        f'--control-h: {sp["control"]}px;',
        f'--r-sm: {sh["radius"][0]}px; --r-md: {sh["radius"][1]}px; --r-lg: {sh["radius"][2]}px;',
        f'--r-btn: {"999px" if sh["button"] == "pill" else str(sh["radius"][1]) + "px"};',
        f'--shadow-card: {d["card"]}; --shadow-pop: {d["pop"]};',
        f'--border-w: {sh["border"]}px; --border-card: {d["line"]}; --border-ctrl: {d["ctrl"]};',
        f'--dur: {r["_motion"]["dur"]};',
    ]
    return lines


def svg(name, size=20):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')

BASE_CSS = """
.ds{ background: var(--bg); color: var(--text); font-family: var(--font-body); font-weight: var(--body-weight); font-size: var(--fs-base); line-height: var(--lh-body); }
.ds h1,.ds h2,.ds h3,.ds .display{ font-family: var(--font-display); font-weight: var(--display-weight); line-height: var(--lh-heading); margin: 0; letter-spacing: -0.01em; text-wrap: balance; }
.ds .btn{ display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: var(--control-h); padding: 0 var(--space-5);
  border-radius: var(--r-btn); font: 600 var(--fs-base)/1 var(--font-body); border: var(--border-w) solid transparent; cursor: pointer; transition: background-color var(--dur), border-color var(--dur), color var(--dur); }
.ds .btn:active{ transform: scale(.97); }
.ds .btn-primary{ background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.ds .btn-primary:hover{ background: var(--accent-hover); border-color: var(--accent-hover); }
.ds .btn-secondary{ background: var(--surface); color: var(--text); border: max(1px, var(--border-w)) solid var(--border-ctrl); }
.ds .btn-secondary:hover{ background: var(--surface-2); }
.ds .btn-ghost{ background: transparent; color: var(--accent-text); padding: 0 var(--space-3); }
.ds .btn-ghost:hover{ background: var(--accent-soft); }
.ds .card{ background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-card); border: var(--border-w) solid var(--border-card); padding: var(--space-5); }
.ds .input{ width: 100%; min-height: var(--control-h); padding: 0 var(--space-3); border-radius: var(--r-md); border: max(1px, var(--border-w)) solid var(--border-ctrl);
  background: var(--surface); color: var(--text); font: var(--fs-base) var(--font-body); }
.ds .input:focus-visible, .ds .btn:focus-visible{ outline: 2px solid var(--focus); outline-offset: 2px; }
.ds .badge{ display: inline-flex; align-items: center; gap: 4px; padding: 2px var(--space-2); border-radius: var(--r-sm); font: 600 var(--fs-sm)/1.4 var(--font-body); white-space: nowrap; }
.ds .badge.ok{ color: var(--success); background: var(--success-soft); } .ds .badge.warn{ color: var(--warning); background: var(--warning-soft); }
.ds .badge.err{ color: var(--danger); background: var(--danger-soft); } .ds .badge.acc{ color: var(--accent-text); background: var(--accent-soft); }
.ds .num{ font-variant-numeric: tabular-nums; }
.ds[data-field="filled"] .input{ background: var(--surface-2); border-color: transparent; border-bottom-color: var(--border-ctrl); border-radius: var(--r-md) var(--r-md) 0 0; }
.ds[data-field="underline"] .input{ background: transparent; border-width: 0 0 max(1px, var(--border-w)); border-radius: 0; padding-inline: 0; }
.ds[data-field="pill"] .input{ border-radius: 999px; padding-inline: var(--space-4); }
.ds[data-btn="chamfer"] .btn, .ds[data-btn="chamfer"] .card{ clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
"""

TILE_CSS = """
*{ box-sizing: border-box; }
body{ margin: 0; background: #ededea; color: #1f1f1c; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  padding: 32px max(16px, env(safe-area-inset-right, 0px)) 48px max(16px, env(safe-area-inset-left, 0px)); }
.page-h{ max-width: 1560px; margin: 0 auto 24px; } .page-h h1{ margin: 0 0 6px; font-size: 26px; } .page-h p{ margin: 0; color: #5d5d58; max-width: 80ch; }
.tiles{ max-width: 1400px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr)); gap: 20px; align-items: start; }
.tile{ container-type: inline-size; border-radius: 18px; overflow: hidden; box-shadow: 0 1px 2px rgb(0 0 0 / .06), 0 12px 40px -18px rgb(0 0 0 / .3); }
.tile-label{ display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 12px 18px; background: #1f1f1c; color: #f4f4f0; font: 600 14px system-ui, sans-serif; }
.tile-label > b{ flex: none; font-weight: 600; }
.tile-label span{ font-weight: 400; color: #b9b9b2; font-size: 13px; }
.tile .in{ padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-5); }
.tile nav{ display: flex; align-items: center; gap: var(--space-4); font-size: var(--fs-sm); color: var(--text-2); }
.tile .logo{ display: flex; align-items: center; gap: var(--space-2); font: var(--display-weight) var(--fs-lg) var(--font-display); color: var(--text); margin-right: auto; }
.tile .logo i{ width: 28px; height: 28px; border-radius: var(--r-md); background: var(--accent); color: var(--on-accent); display: grid; place-items: center; font-style: normal; font-size: 14px; }
.tile .eyebrow{ font: 600 var(--fs-sm) var(--font-body); color: var(--accent-text); text-transform: uppercase; letter-spacing: .08em; }
.tile .display{ font-size: min(var(--fs-display), 13cqi); }
.tile p.lead{ margin: 0; color: var(--text-2); max-width: 46ch; }
.tile .row{ display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.tile .kpi{ display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-3); }
.tile .kpi .v{ font: var(--display-weight) min(var(--fs-h1), 8.5cqi)/1 var(--font-display); white-space: nowrap; }
.tile .kpi small{ display: block; color: var(--text-2); font-size: var(--fs-sm); margin-bottom: var(--space-1); }
.tile .bars{ display: flex; align-items: flex-end; gap: 6px; height: 56px; }
.tile .bars i{ flex: 1; background: var(--surface-2); border-radius: var(--r-sm) var(--r-sm) 0 0; }
.tile .bars i.a{ background: var(--accent); }
.tile label.f{ display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--fs-sm); font-weight: 600; }
.tile .icons{ display: flex; gap: var(--space-3); color: var(--text-2); }
.tile .sw{ display: flex; height: 22px; border-radius: var(--r-sm); overflow: hidden; border: 1px solid var(--border); }
.tile .sw i{ flex: 1; }
.tile dl{ margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 12.5px; color: var(--text-2); font-family: system-ui, sans-serif; }
.tile dt{ color: var(--text); font-weight: 600; }
.tile dd{ margin: 0; }
.tile .sig{ font-size: 13px; color: var(--text-2); border-top: 1px solid var(--border); padding-top: var(--space-3); font-family: system-ui, sans-serif; }
"""



TILE_CSS = """
*{ box-sizing: border-box; }
body{ margin: 0; background: #ededea; color: #1f1f1c; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  padding: 32px max(16px, env(safe-area-inset-right, 0px)) 48px max(16px, env(safe-area-inset-left, 0px)); }
.page-h{ max-width: 1560px; margin: 0 auto 24px; } .page-h h1{ margin: 0 0 6px; font-size: 26px; } .page-h p{ margin: 0; color: #5d5d58; max-width: 80ch; }
.tiles{ max-width: 1560px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 20px; align-items: start; }
.tile{ container-type: inline-size; border-radius: 18px; overflow: hidden; box-shadow: 0 1px 2px rgb(0 0 0 / .06), 0 12px 40px -18px rgb(0 0 0 / .3); }
.tile-label{ display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 12px 18px; background: #1f1f1c; color: #f4f4f0; font: 600 14px system-ui, sans-serif; }
.tile-label > b{ flex: none; font-weight: 600; }
.tile-label span{ font-weight: 400; color: #b9b9b2; font-size: 13px; text-align: right; }
.tile .in{ padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-5); }
.tile nav{ display: flex; align-items: center; gap: var(--space-4); font-size: var(--fs-sm); color: var(--text-2); }
.tile .logo{ display: flex; align-items: center; gap: var(--space-2); font: var(--display-weight) var(--fs-lg) var(--font-display); color: var(--text); margin-right: auto; }
.tile .logo i{ width: 28px; height: 28px; border-radius: var(--r-md); background: var(--accent); color: var(--on-accent); display: grid; place-items: center; font-style: normal; font-size: 14px; }
.tile .eyebrow{ font: 600 var(--fs-sm) var(--font-body); color: var(--accent-text); text-transform: uppercase; letter-spacing: .08em; margin-bottom: var(--space-2); }
.tile .display{ font-size: min(var(--fs-display), 12cqi); }
.tile p.lead{ margin: 0; color: var(--text-2); font-size: var(--fs-lg); max-width: 46ch; }
.tile .row{ display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.tile .kpi{ display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-3); }
.tile .kpi .v{ font: var(--display-weight) min(var(--fs-h1), 8.5cqi)/1 var(--font-display); white-space: nowrap; }
.tile .kpi small{ display: block; color: var(--text-2); font-size: var(--fs-sm); margin-bottom: var(--space-1); }
.tile .bars{ display: flex; align-items: flex-end; gap: 6px; height: 56px; margin-top: var(--space-4); }
.tile .bars i{ flex: 1; background: var(--surface-2); border-radius: var(--r-sm) var(--r-sm) 0 0; }
.tile .bars i.a{ background: var(--accent); }
.tile label.f{ display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--fs-sm); font-weight: 600; }
.tile .icons{ display: flex; gap: var(--space-3); color: var(--text-2); }
.tile .sw{ display: flex; height: 22px; border-radius: var(--r-sm); overflow: hidden; border: 1px solid var(--border); }
.tile .sw i{ flex: 1; }
.tile .ladder{ display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; color: var(--text); font-family: var(--font-display); border-top: 1px solid var(--border); padding-top: var(--space-3); }
.tile .ladder span{ line-height: 1; } .tile .ladder em{ font: 11px system-ui, sans-serif; font-style: normal; color: var(--text-2); display: block; margin-top: 4px; }
.tile dl{ margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12.5px; line-height: 1.45; color: var(--text-2); font-family: system-ui, sans-serif; }
.tile dt{ color: var(--text); font-weight: 600; }
.tile dd{ margin: 0; } .tile dd b{ color: var(--text); font-weight: 600; }
.tile .sig{ font-size: 13px; color: var(--text-2); border-top: 1px solid var(--border); padding-top: var(--space-3); font-family: system-ui, sans-serif; }
"""


def esc(x): return html.escape(str(x))


def decisions(r):
    t, sz, sp, sh, c = r["_type"], sizes(r["_type"]), r["space"], r["shape"], r["color"]
    theme = "тёмная" if r["_dark_first"] else "светлая"
    fam = t["display"] if t["display"] == t["body"] else f'{t["display"]} {t["display_weight"]} / {t["body"]}'
    return [
        ("Шрифт", f'<b>{esc(fam)}</b>{" + " + esc(t["mono"]) if t.get("mono") else ""}', t.get("why")),
        ("Размеры", f'<b>база {sz["base"]}, ×{t["ratio"]}</b>: {sz["sm"]} · {sz["base"]} · {sz["lg"]} · {sz["h3"]} · {sz["h2"]} · {sz["h1"]} · {sz["display"]}', None),
        ("Отступы", f'<b>{" · ".join(map(str, sp["scale"]))}</b>, контрол {sp["control"]}', sp.get("why")),
        ("Форма", f'<b>радиусы {" / ".join(map(str, sh["radius"]))}</b>, кнопка {sh["button"]}, поле {sh.get("field", "outline")}, рамка {sh["border"]}', sh.get("why")),
        ("Цвет", f'<b>H {c["hue"]}, C {c.get("chroma", .12)}</b>, нейтрали {r["_neutral"]}, фон {c.get("bg", "tinted")}{f", оттенок {c.get('tint')}" if c.get("tint") else ""}, {theme}{", яркий акцент" if c.get("bright") else ""}', c.get("why")),
        ("Глубина", f'<b>{esc(r.get("depth", {}).get("style", "soft"))}</b>', r.get("depth", {}).get("why")),
        ("Движение", f'<b>{esc(r["_motion"]["label"])}</b>', r.get("motion", {}).get("why")),
    ]


def tile(r):
    key = r["_key"]; theme = "dark" if r["_dark_first"] else "light"
    tok = "\n  ".join(tokens(r, theme)); c = r["_colors"][theme]; sz = sizes(r["_type"]); x = r["_sample"]
    sw = "".join(f'<i style="background:{c[k]}" title="{k} {c[k]}"></i>' for k in ["bg", "surface-2", "border", "text-2", "text", "accent", "accent-soft"])
    icons = "".join(svg(n, 20) for n in x["icons"] if n in ICONS)
    ladder = "".join(f'<span style="font-size:{min(v, 64)}px">Аа<em>{k} {v}</em></span>' for k, v in sz.items() if k != "sm")
    dl = "".join(f'<dt>{k}</dt><dd>{v}{" — " + esc(w) if w else ""}</dd>' for k, v, w in decisions(r))
    chips = "".join(f'<span class="badge {cls}">{esc(t)}</span>' for cls, t in zip(["ok", "warn", "err", "acc"], x["chips"]))
    nav = "".join(f"<span>{esc(n)}</span>" for n in x["nav"])
    css = f'.tile[data-k="{key}"]{{\n  {tok}\n}}'
    body = f'''
<section class="tile ds" data-k="{key}" data-btn="{r["shape"]["button"]}" data-field="{r["shape"].get("field", "outline")}" aria-label="Вариант {esc(r["name"])}">
  <div class="tile-label"><b>{esc(r["name"])}</b><span>{esc(r.get("brief", ""))}</span></div>
  <div class="in">
    <nav><span class="logo"><i>{esc(x["brand"][0])}</i>{esc(x["brand"])}</span>{nav}{svg("bell", 18)}</nav>
    <div><div class="eyebrow">{esc(x["eyebrow"])}</div><h1 class="display">{esc(x["title"])}</h1></div>
    <p class="lead">{esc(x["lead"])}</p>
    <div class="row"><button class="btn btn-primary" type="button">{esc(x["primary"])}</button><button class="btn btn-secondary" type="button">{esc(x["secondary"])}</button><button class="btn btn-ghost" type="button">{esc(x["tertiary"])}</button></div>
    <div class="card">
      <div class="kpi"><div><small>{esc(x["kpi_label"])}</small><span class="v num">{esc(x["kpi"])}</span></div><span class="badge ok">{esc(x["delta"])}</span></div>
      <div class="bars" aria-hidden="true"><i style="height:40%"></i><i style="height:55%"></i><i style="height:48%"></i><i style="height:70%"></i><i class="a" style="height:92%"></i></div>
    </div>
    <label class="f">{esc(x["field"])}<input class="input" value="{esc(x["value"])}"></label>
    <div class="row">{chips}</div>
    <div class="icons">{icons}</div>
    <div class="sw" aria-hidden="true">{sw}</div>
    <div class="ladder" aria-hidden="true">{ladder}</div>
    <dl>{dl}</dl>
    <div class="sig">Фирменная деталь: {esc(r.get("signature", "—"))}</div>
  </div>
</section>'''
    return css, body


def page(specs, fonts_dir=None):
    fams, css, bodies = [], [], []
    for r in specs:
        for f in fonts(r):
            if f not in fams: fams.append(f)
        c, b = tile(r); css.append(c); bodies.append(b)
    return f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Варианты стиля</title>
{"" if fonts_dir else font_links(fams)}
<style>{embed_fonts(fams, used_weights(specs), fonts_dir) if fonts_dir else ""}
{TILE_CSS}{BASE_CSS}
{chr(10).join(css)}
</style></head>
<body>
<header class="page-h"><h1>Варианты стиля</h1><p>Каждый вариант выведен из брифа: у каждого решения указана причина. Выберите один или скажите, что взять из разных. После выбора система фиксируется, и все экраны строятся только на её токенах.</p></header>
<main class="tiles">{"".join(bodies)}</main>
</body></html>'''


def export(r, outdir):
    os.makedirs(outdir, exist_ok=True)
    light = "\n  ".join(tokens(r, "light")); dark = "\n  ".join(tokens(r, "dark"))
    if r["_dark_first"]:
        theme_css = (f":root{{\n  {dark}\n  color-scheme: dark;\n}}\n@media (prefers-color-scheme: light){{\n  :root:not([data-theme=\"dark\"]){{\n  {light}\n  color-scheme: light;\n  }}\n}}\n"
                     f":root[data-theme=\"light\"]{{\n  {light}\n  color-scheme: light;\n}}\n")
    else:
        theme_css = (f":root{{\n  {light}\n}}\n@media (prefers-color-scheme: dark){{\n  :root:not([data-theme=\"light\"]){{\n  {dark}\n  color-scheme: dark;\n  }}\n}}\n"
                     f":root[data-theme=\"dark\"]{{\n  {dark}\n  color-scheme: dark;\n}}\n")
    base = BASE_CSS.replace('.ds[data-btn="chamfer"]', 'body[data-btn="chamfer"]').replace('.ds[data-field=', 'body[data-field=').replace(".ds ", "").replace(".ds{", "body{")
    open(os.path.join(outdir, "design-system.css"), "w", encoding="utf-8").write(
        f"/* Дизайн-система «{r['name']}». Сгенерировано style_tiles.py. Все экраны — только на этих токенах. */\n{theme_css}\n{base}")
    t, sz, sp, sh = r["_type"], sizes(r["_type"]), r["space"], r["shape"]
    c = r["_colors"]["dark" if r["_dark_first"] else "light"]
    rows = "\n".join(f"| {k} | {v.replace('<b>', '**').replace('</b>', '**')} | {w or ''} |" for k, v, w in decisions(r))
    md = f"""# Дизайн-система: {r['name']}

**Бриф:** {r.get('brief', '')}

Токены — `design-system.css` (вставь в начало `<style>`). Источник решений — `system.json`.

## Шрифты

```html
{font_links(fonts(r))}
```
{'Кнопки и карточки со срезанными углами: `<body data-btn="chamfer">`.' if sh["button"] == "chamfer" else ""}
Вид полей: `<body data-field="{sh.get("field", "outline")}">`.

## Решения и причины

| Слой | Решение | Почему |
|---|---|---|
{rows}
| Иконки | Lucide из `assets/icons` (`scripts/icon.py`), обводка 2 при 24 | Один набор; **эмодзи не используются** |
| Фирменная деталь | {r.get('signature', '—')} | Повторяется на каждом экране |

## Шкала

| Токен | Значение |
|---|---|
""" + "\n".join(f"| `--fs-{k}` | {rem(v)} ({v} px) |" for k, v in sz.items()) + "\n" + \
        "\n".join(f"| `--space-{i + 1}` | {v} px |" for i, v in enumerate(sp["scale"])) + f"""
| `--control-h` | {sp['control']} px |
| `--r-sm / --r-md / --r-lg` | {' / '.join(map(str, sh['radius']))} px |
| Акцент / фон / текст | `{c['accent']}` / `{c['bg']}` / `{c['text']}` |

## Правила для всех экранов

- Только токены этого файла. Новое значение — сначала в `system.json` с причиной, потом в макет.
- Текст — только `--fs-*`, отступы — только `--space-*`, радиусы — только `--r-*`.
- Главная кнопка одна на экран; кнопка формы — в конце, по левому краю полей (`references/23`, раздел 5).
- Акцент — не больше 10% площади экрана: главная кнопка, ссылки, выбранное состояние, фирменная деталь.
- Числа — `font-variant-numeric: tabular-nums`.
"""
    md += """
## Другие форматы

- `tokens.json` — те же токены в формате W3C DTCG 2025.10 (Style Dictionary, Tokens Studio, Figma-плагины).
- `tailwind.css` — для Tailwind v4: подключи после `@import "tailwindcss";` — классы `bg-surface`, `text-text-2`, `text-h2`, `rounded-md`, `shadow-surface`, `font-heading` берут значения из токенов; цветовые имена shadcn/ui (`bg-background`, `bg-primary`, `text-muted-foreground`…) указывают на те же токены.
"""
    with open(os.path.join(outdir, "DESIGN.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(md)
    with open(os.path.join(outdir, "tokens.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(dtcg(r), f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(os.path.join(outdir, "tailwind.css"), "w", encoding="utf-8", newline="\n") as f:
        f.write(tailwind(r, theme_css))
    return [os.path.join(outdir, n) for n in ("design-system.css", "DESIGN.md", "tokens.json", "tailwind.css")]


def dtcg(r):
    """Токены системы в формате W3C Design Tokens (Format Module 2025.10): цвет и размеры — объекты."""
    t, sz, sp, sh = r["_type"], sizes(r["_type"]), r["space"], r["shape"]

    def color(h):
        return {"$type": "color", "$value": {"colorSpace": "srgb", "components": [round(v, 4) for v in hex_to_rgb(h)], "hex": h}}

    def dim(v, unit="px"):
        return {"$type": "dimension", "$value": {"value": v, "unit": unit}}

    def family(name, fallback):
        return {"$type": "fontFamily", "$value": [name] + fallback}

    mono = t.get("mono") or "ui-monospace"
    return {
        "$description": f"Дизайн-система «{r['name']}». {r.get('brief', '')}".strip(),
        "color": {
            theme: {"$description": f"Тема: {'светлая' if theme == 'light' else 'тёмная'}" + (" (по умолчанию)" if (theme == "dark") == r["_dark_first"] else ""),
                    **{k: color(r["_colors"][theme][k]) for k in ORDER}}
            for theme in ("light", "dark")
        },
        "font": {
            "family": {"display": family(t["display"], ["system-ui", "sans-serif"]),
                       "body": family(t["body"], ["system-ui", "-apple-system", "Segoe UI", "sans-serif"]),
                       "mono": family(mono, ["ui-monospace", "Menlo", "monospace"])},
            "weight": {"display": {"$type": "fontWeight", "$value": t["display_weight"]},
                       "body": {"$type": "fontWeight", "$value": t["body_weight"]}},
            "size": {k: dim(round(v / 16, 4), "rem") for k, v in sz.items()},
            "lineHeight": {"body": {"$type": "number", "$value": t["line"]},
                           "heading": {"$type": "number", "$value": t["heading_line"]}},
        },
        "space": {str(i + 1): dim(v) for i, v in enumerate(sp["scale"])},
        "size": {"control": dim(sp["control"])},
        "radius": {"sm": dim(sh["radius"][0]), "md": dim(sh["radius"][1]), "lg": dim(sh["radius"][2]),
                   "button": dim(999 if sh["button"] == "pill" else sh["radius"][1])},
        "border": {"width": dim(sh["border"])},
        "duration": {"base": {"$type": "duration", "$value": {"value": int(r["_motion"]["dur"].rstrip("ms")), "unit": "ms"}}},
    }


SHADCN = {  # цветовые имена shadcn/ui → токены системы (accent и border совпадают с нашими именами)
    "background": "bg", "foreground": "text", "card": "surface", "card-foreground": "text",
    "popover": "surface", "popover-foreground": "text", "primary": "accent", "primary-foreground": "on-accent",
    "secondary": "surface-2", "secondary-foreground": "text", "muted": "surface-2", "muted-foreground": "text-2",
    "accent-foreground": "accent-text", "destructive": "danger", "input": "border-strong", "ring": "focus",
}


def tailwind(r, theme_css):
    """Tailwind v4: значения живут в CSS-переменных системы (обе темы), @theme inline связывает их с утилитами.
    Новых переменных с теми же именами не создаём — иначе циклы (--font-mono: var(--font-mono)) и перезапись токенов."""
    colors = "\n".join(f"  --color-{k}: var(--{k});" for k in ORDER)
    shad = "\n".join(f"  --color-{k}: var(--{v});" for k, v in SHADCN.items())
    sizes_ = "\n".join(f"  --text-{k}: var(--fs-{k});" for k in sizes(r["_type"]))
    return f"""/* Дизайн-система «{r['name']}» для Tailwind v4. Сгенерировано style_tiles.py.
   Подключение: @import "tailwindcss"; @import "./tailwind.css";
   Темы переключаются сами (prefers-color-scheme) или атрибутом data-theme на <html>.
   Наши --font-mono и другие токены объявлены вне слоёв и поэтому сильнее значений темы Tailwind. */

{theme_css}
@theme inline {{
  /* токены системы: bg-surface, text-text-2, bg-accent, text-on-accent, border-border-strong … */
{colors}
  /* имена shadcn/ui. bg-accent здесь — фирменный цвет; где shadcn ждёт мягкий фон наведения, ставь bg-accent-soft */
{shad}
  --font-sans: var(--font-body);
  --font-heading: var(--font-display);
{sizes_}
  --text-base--line-height: var(--lh-body);
  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
  --radius-lg: var(--r-lg);
  --radius-btn: var(--r-btn);
  --shadow-surface: var(--shadow-card);
  --shadow-popover: var(--shadow-pop);
  --spacing: {r['space']['scale'][0]}px;
}}
"""


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("systems", nargs="*", help="файлы system.json")
    p.add_argument("-o", "--out", default="style-tiles.html")
    p.add_argument("--export", metavar="SYSTEM_JSON")
    p.add_argument("-d", "--dir", default="design")
    p.add_argument("--check", action="store_true", help="только проверить")
    p.add_argument("--strict", action="store_true", help="код выхода 1, если есть предупреждения (для CI)")
    p.add_argument("--embed-fonts", metavar="DIR", help="встроить шрифты из DIR/node_modules/@fontsource (офлайн-файл)")
    a = p.parse_args()
    paths = [a.export] if a.export else a.systems
    if not paths:
        print("Укажи файлы system.json (схема — references/23, раздел 8)", file=sys.stderr); return 1
    try:
        specs = [load(x) for x in paths]
    except SpecError as e:
        print(f"ошибка: {e}", file=sys.stderr); return 2
    warnings = 0
    for r in specs:
        for w in check(r):
            warnings += 1
            print(f"[{r['_key']}] предупреждение: {w}", file=sys.stderr)
    for i in range(len(specs)):
        for j in range(i + 1, len(specs)):
            n = distinct(specs[i], specs[j])
            if n < 3:
                warnings += 1
                print(f"[{specs[i]['_key']} ↔ {specs[j]['_key']}] палитры различаются только по {n} из 6 признаков — это почти один вариант", file=sys.stderr)
    if len(specs) > 1 and len({s["space"]["control"] for s in specs}) == 1:
        warnings += 1
        print(f"варианты не различаются по высоте контролов ({specs[0]['space']['control']} px у всех) — размер поля тоже часть характера", file=sys.stderr)
    if len(specs) > 1 and len({s["shape"].get("field", "outline") for s in specs}) == 1:
        warnings += 1
        print(f"у всех вариантов один вид поля ({specs[0]['shape'].get('field', 'outline')}) — попробуй контур, заливку, подчёркивание или таблетку", file=sys.stderr)
    if a.strict and warnings: return 1
    if a.check: return 0
    if a.export:
        for f in export(specs[0], a.dir): print("ok", f)
        return 0
    open(a.out, "w", encoding="utf-8").write(page(specs, a.embed_fonts))
    print("ok", a.out)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):   # консоли Windows с cp1251/cp866 падают на «≈», «—», «₸»
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
