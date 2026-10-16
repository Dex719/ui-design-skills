#!/usr/bin/env python3
"""Добавляет в CSS ручной режим «полное движение».

Все правила движения пишутся внутри
  @media (prefers-reduced-motion: no-preference){ :root:not([data-motion="reduce"]) ... }
Скрипт копирует эти блоки с селектором :root[data-motion="full"] и без media-обёртки,
чтобы пользователь мог включить анимации на сайте, даже если в системе
стоит «уменьшить движение» (кнопка «Показать анимации»).

  python3 build_motion_override.py effects.css           # перезаписывает файл, блок между маркерами
  python3 build_motion_override.py --check effects.css   # только проверить, что блок актуален (CI)
"""
import argparse, re, sys

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
            if j >= len(css):
                raise ValueError("незакрытая скобка в @media (prefers-reduced-motion: no-preference)")
            c = css[j]
            depth += (c == "{") - (c == "}")
            j += 1
        out.append(css[m.end():j - 1])
        i = j

def build(css):
    css = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", css, flags=re.S)
    body = "\n".join(b.replace(':root:not([data-motion="reduce"])', ':root[data-motion="full"]') for b in blocks(css))
    return css.rstrip() + "\n\n" + START + "\n" + body.strip() + "\n" + END + "\n"

def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", metavar="CSS", help="CSS-файлы с правилами движения")
    ap.add_argument("--check", action="store_true", help="ничего не писать; код 1, если блок устарел")
    a = ap.parse_args(argv)
    stale = 0
    for p in a.files:
        try:
            t = open(p, encoding="utf-8").read().replace("\r\n", "\n")
            new = build(t)
        except (OSError, ValueError) as e:
            print(f"ошибка: {p}: {e}", file=sys.stderr)
            return 2
        if a.check:
            if new != t:
                stale += 1
                print(f"устарел: {p}")
            continue
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(new)
        print("ok", p)
    return 1 if stale else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):   # консоли Windows с cp1251/cp866 падают на «≈», «—», «₸»
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main(sys.argv[1:]))
