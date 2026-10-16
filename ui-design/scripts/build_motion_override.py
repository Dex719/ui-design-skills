#!/usr/bin/env python3
"""Добавляет в CSS ручной режим «полное движение».

Все правила движения пишутся внутри
  @media (prefers-reduced-motion: no-preference){ :root:not([data-motion="reduce"]) ... }
Скрипт копирует эти блоки с селектором :root[data-motion="full"] и без media-обёртки,
чтобы пользователь мог включить анимации на сайте, даже если в системе
стоит «уменьшить движение» (кнопка «Показать анимации»).

  python3 build_motion_override.py effects.css   # перезаписывает файл, блок между маркерами
"""
import re, sys

START = "/* >>> motion-full override (сгенерировано build_motion_override.py) */"
END = "/* <<< motion-full override */"

def blocks(css):
    out, i = [], 0
    pat = re.compile(r"@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{")
    while True:
        m = pat.search(css, i)
        if not m: return out
        depth, j = 1, m.end()
        while depth:
            c = css[j]
            depth += (c == "{") - (c == "}")
            j += 1
        out.append(css[m.end():j - 1])
        i = j

def build(css):
    css = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", css, flags=re.S)
    body = "\n".join(b.replace(':root:not([data-motion="reduce"])', ':root[data-motion="full"]') for b in blocks(css))
    return css.rstrip() + "\n\n" + START + "\n" + body.strip() + "\n" + END + "\n"

if __name__ == "__main__":
    for p in sys.argv[1:]:
        t = open(p, encoding="utf-8").read()
        open(p, "w", encoding="utf-8").write(build(t))
        print("ok", p)
