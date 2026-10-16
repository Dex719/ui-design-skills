#!/usr/bin/env python3
"""Генератор палитры: один акцент + тонированные нейтрали Radix, светлая и тёмная тема,
контраст WCAG проверяется и подгоняется автоматически.

Примеры:
  python3 make_palette.py --hue 215 --chroma 0.11                    # нейтрали подберутся по тону
  python3 make_palette.py --hue 38 --chroma 0.13 --neutral sand --name editorial
  python3 make_palette.py --hue 12 --chroma 0.12 --max-l 0.42        # глубокий акцент (бордо)
  python3 make_palette.py --hue 75 --chroma 0.15 --json              # данные для превью

Тон (H, OKLCH): красный ≈ 20-30, оранжевый ≈ 50-60, жёлтый ≈ 90, зелёный ≈ 140-160,
бирюза ≈ 180-200, синий ≈ 230-250, индиго ≈ 265-280, фиолетовый ≈ 300, малина ≈ 350.
Хрома: 0.06-0.10 — мягко и приглушённо, 0.11-0.15 — уверенно, 0.16+ — ярко.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_contrast import contrast, hex_to_oklch, oklch_to_hex  # noqa: E402

# Шаги 1-12 Radix Colors (MIT), светлая и тёмная тема.
NEUTRALS = {
    "gray":  ("#fcfcfc #f9f9f9 #f0f0f0 #e8e8e8 #e0e0e0 #d9d9d9 #cecece #bbbbbb #8d8d8d #838383 #646464 #202020",
              "#111111 #191919 #222222 #2a2a2a #313131 #3a3a3a #484848 #606060 #6e6e6e #7b7b7b #b4b4b4 #eeeeee"),
    "slate": ("#fcfcfd #f9f9fb #f0f0f3 #e8e8ec #e0e1e6 #d9d9e0 #cdced6 #b9bbc6 #8b8d98 #80838d #60646c #1c2024",
              "#111113 #18191b #212225 #272a2d #2e3135 #363a3f #43484e #5a6169 #696e77 #777b84 #b0b4ba #edeef0"),
    "sand":  ("#fdfdfc #f9f9f8 #f1f0ef #e9e8e6 #e2e1de #dad9d6 #cfceca #bcbbb5 #8d8d86 #82827c #63635e #21201c",
              "#111110 #191918 #222221 #2a2a28 #31312e #3b3a37 #494844 #62605b #6f6d66 #7c7b74 #b5b3ad #eeeeec"),
    "mauve": ("#fdfcfd #faf9fb #f2eff3 #eae7ec #e3dfe6 #dbd8e0 #d0cdd7 #bcbac7 #8e8c99 #84828e #65636d #211f26",
              "#121113 #1a191b #232225 #2b292d #323035 #3c393f #49474e #625f69 #6f6d78 #7c7a85 #b5b2bc #eeeef0"),
    "sage":  ("#fbfdfc #f7f9f8 #eef1f0 #e6e9e8 #dfe2e0 #d7dad9 #cbcfcd #b8bcba #868e8b #7c8481 #5f6563 #1a211e",
              "#101211 #171918 #202221 #272a29 #2e3130 #373b39 #444947 #5b625f #63706b #717d79 #adb5b2 #eceeed"),
    "olive": ("#fcfdfc #f8faf8 #eff1ef #e7e9e7 #dfe2df #d7dad7 #cccfcc #b9bcb8 #898e87 #7f847d #60655f #1d211c",
              "#111210 #181917 #212220 #282a27 #2f312e #383a36 #454843 #5c625b #687066 #767d74 #afb5ad #eceeec"),
}
NEUTRALS = {k: (l.split(), d.split()) for k, (l, d) in NEUTRALS.items()}

# Семантика Radix: (текст, мягкий фон) — red/green/amber шаги 11 и 3.
SEMANTIC = {
    "light": {"success": ("#218358", "#e6f6eb"), "warning": ("#ab6400", "#fff7c2"), "danger": ("#ce2c31", "#feebec")},
    "dark":  {"success": ("#3dd68c", "#132d21"), "warning": ("#ffca16", "#302008"), "danger": ("#ff9592", "#3b1219")},
}


def neutral_for_hue(h):
    """Пара «нейтраль ↔ акцент» по правилу Radix: серый с ближайшим тоном."""
    h %= 360
    if h < 30 or h >= 300:
        return "mauve"
    if h < 100:
        return "sand"
    if h < 150:
        return "olive"
    if h < 200:
        return "sage"
    return "slate"


def ensure(fg, bgs, target, step):
    """Сдвигает светлоту fg (step<0 темнее, >0 светлее), пока контраст со всеми bgs >= target."""
    L, C, H = hex_to_oklch(fg)
    for _ in range(80):
        if all(contrast(fg, b) >= target for b in bgs):
            return fg
        L = min(0.99, max(0.02, L + step))
        fg = oklch_to_hex(L, C, H)
    return fg


def build(hue, chroma, neutral, max_l=0.62, bright=False):
    nl, nd = NEUTRALS[neutral]
    t = {"light": {}, "dark": {}}

    # ---- светлая тема ----
    L = t["light"]
    L.update(bg=nl[1], surface="#ffffff", **{"surface-2": nl[2], "border": nl[5],
             "border-strong": nl[8], "text": nl[11], "text-2": nl[10]})
    L["accent-soft"] = oklch_to_hex(0.955, min(chroma * 0.3, 0.035), hue)
    if bright:   # яркая кнопка с тёмным текстом (жёлтый, лайм, мята, небесный)
        acc = ensure(oklch_to_hex(0.84, chroma, hue), [nl[11]], 4.6, +0.01)
        a_l, a_c, a_h = hex_to_oklch(acc)
        L["accent"] = acc
        L["accent-hover"] = oklch_to_hex(a_l - 0.04, a_c, a_h)
        L["on-accent"] = nl[11]
        L["accent-text"] = ensure(oklch_to_hex(0.55, min(chroma, 0.14), hue), [L["bg"], L["surface"], L["accent-soft"]], 4.6, -0.01)
    else:
        acc = oklch_to_hex(max_l, chroma, hue)
        acc = ensure(acc, ["#ffffff"], 4.6, -0.01)
        a_l, a_c, a_h = hex_to_oklch(acc)
        L["accent"] = acc
        L["accent-hover"] = oklch_to_hex(a_l - 0.05, a_c, a_h)
        L["on-accent"] = "#ffffff"
        L["accent-text"] = ensure(acc, [L["bg"], L["surface"], L["accent-soft"]], 4.6, -0.01)
    L["focus"] = L["accent-text"]
    L["border-strong"] = ensure(L["border-strong"], [L["surface"], L["bg"]], 3.0, -0.01)
    for k, (fg, soft) in SEMANTIC["light"].items():
        L[k + "-soft"] = soft
        L[k] = ensure(fg, [L["surface"], L["bg"], soft], 4.6, -0.01)

    # ---- тёмная тема ----
    D = t["dark"]
    D.update(bg=nd[0], surface=nd[1], **{"surface-2": nd[2], "border": nd[5],
             "border-strong": nd[7], "text": nd[11], "text-2": nd[10]})
    dacc = ensure(oklch_to_hex(0.78, chroma * 0.85, hue), [nd[0]], 4.6, +0.01)
    d_l, d_c, d_h = hex_to_oklch(dacc)
    D["accent"] = dacc
    D["accent-hover"] = oklch_to_hex(min(0.95, d_l + 0.04), d_c, d_h)
    D["on-accent"] = nd[0]
    D["accent-soft"] = oklch_to_hex(0.30, min(chroma * 0.4, 0.07), hue)
    D["accent-text"] = ensure(oklch_to_hex(0.80, chroma * 0.8, hue), [D["bg"], D["surface"], D["accent-soft"]], 4.6, +0.01)
    D["focus"] = D["accent-text"]
    D["border-strong"] = ensure(D["border-strong"], [D["surface"], D["bg"]], 3.0, +0.01)
    for k, (fg, soft) in SEMANTIC["dark"].items():
        D[k + "-soft"] = soft
        D[k] = ensure(fg, [D["surface"], D["bg"], soft], 4.6, +0.01)
    return t


ORDER = ["bg", "surface", "surface-2", "border", "border-strong", "text", "text-2",
         "accent", "accent-hover", "on-accent", "accent-text", "accent-soft", "focus",
         "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft"]


def css(t, name, dark_first=False):
    def block(d, indent="  "):
        return "\n".join(f"{indent}--{k}: {d[k]};" for k in ORDER)
    head = f"/* Палитра «{name}». Сгенерировано make_palette.py, контраст WCAG проверен. */\n"
    if not dark_first:
        return (head + f":root{{\n{block(t['light'])}\n}}\n"
                f"@media (prefers-color-scheme: dark){{\n  :root:not([data-theme=\"light\"]){{\n"
                f"{block(t['dark'], '    ')}\n    color-scheme: dark;\n  }}\n}}\n"
                f":root[data-theme=\"dark\"]{{\n{block(t['dark'])}\n  color-scheme: dark;\n}}\n"
                f"body{{ background: var(--bg); color: var(--text); }}\n")
    return (head + "/* Тёмная тема по умолчанию; светлая — по системной настройке или data-theme=\"light\". */\n"
            f":root{{\n{block(t['dark'])}\n  color-scheme: dark;\n}}\n"
            f"@media (prefers-color-scheme: light){{\n  :root:not([data-theme=\"dark\"]){{\n"
            f"{block(t['light'], '    ')}\n    color-scheme: light;\n  }}\n}}\n"
            f":root[data-theme=\"light\"]{{\n{block(t['light'])}\n  color-scheme: light;\n}}\n"
            f"body{{ background: var(--bg); color: var(--text); }}\n")


def report(t):
    pairs = [("text", "bg", 4.5), ("text-2", "surface", 4.5), ("on-accent", "accent", 4.5),
             ("on-accent", "accent-hover", 4.5), ("accent-text", "bg", 4.5), ("accent-text", "accent-soft", 4.5),
             ("border-strong", "surface", 3.0), ("success", "success-soft", 4.5),
             ("warning", "warning-soft", 4.5), ("danger", "danger-soft", 4.5)]
    lines, fails = [], 0
    for theme in ("light", "dark"):
        d = t[theme]
        for fg, bg, need in pairs:
            c = contrast(d[fg], d[bg])
            fails += c < need
            lines.append(f"/* {theme:5} {fg:>13} on {bg:<13} {c:5.2f}:1 {'OK' if c >= need else 'FAIL'} */")
    return "\n".join(lines), fails


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--hue", type=float, required=True, help="тон акцента в OKLCH, 0-360")
    p.add_argument("--chroma", type=float, default=0.12, help="хрома акцента (0.06 мягко … 0.18 ярко)")
    p.add_argument("--neutral", choices=list(NEUTRALS) + ["auto"], default="auto")
    p.add_argument("--max-l", type=float, default=0.62, help="стартовая светлота кнопки (ниже = глубже)")
    p.add_argument("--name", default="custom")
    p.add_argument("--bright", action="store_true", help="яркая кнопка с тёмным текстом (жёлтый, лайм, мята, небесный)")
    p.add_argument("--dark-first", action="store_true", help="тёмная тема по умолчанию")
    p.add_argument("--json", action="store_true")
    a = p.parse_args()
    neutral = neutral_for_hue(a.hue) if a.neutral == "auto" else a.neutral
    t = build(a.hue, a.chroma, neutral, a.max_l, a.bright)
    if a.json:
        print(json.dumps({"name": a.name, "neutral": neutral, "hue": a.hue, "chroma": a.chroma, "bright": a.bright, "dark_first": a.dark_first, **t}, ensure_ascii=False))
        return 0
    rep, fails = report(t)
    print(css(t, a.name, a.dark_first))
    print(f"/* нейтрали: {neutral} (Radix) */\n{rep}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
