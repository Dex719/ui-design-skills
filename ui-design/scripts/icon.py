#!/usr/bin/env python3
"""Выдаёт готовый inline-SVG иконки из assets/icons (Lucide, лицензия ISC).

  python3 icon.py check                       # <svg ...> с stroke=currentColor, 24px, aria-hidden
  python3 icon.py bell --size 20 --stroke 1.75
  python3 icon.py trash-2 --label "Удалить"   # иконка со смыслом без текста рядом: role=img + aria-label
  python3 icon.py --list                      # все иконки по группам
  python3 icon.py --sprite                    # весь спрайт <symbol id="i-…"> для вставки в начало <body>

Правила: иконки вместо эмодзи всегда; один набор на продукт; размеры 16/20/24/32;
толщина линии одна на весь продукт (обычно 2 при 24px, 1.75 при 20px).
"""
import argparse, difflib, html, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "assets", "icons", "icons.json")

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("name", nargs="?", help="имя иконки Lucide, например bell или trash-2")
    p.add_argument("--size", type=int, default=24, help="ширина и высота в px (16/20/24/32)")
    p.add_argument("--stroke", type=float, default=2, help="толщина линии (2 при 24px, 1.75 при 20px)")
    p.add_argument("--label", help="смысл для скринридера, если рядом нет текста: role=img + aria-label")
    p.add_argument("--cls", default="icon", help="CSS-класс у <svg>")
    p.add_argument("--list", action="store_true", help="все иконки по группам")
    p.add_argument("--sprite", action="store_true", help="весь спрайт <symbol id=\"i-…\">")
    a = p.parse_args()
    d = json.load(open(DATA, encoding="utf-8"))
    if a.list:
        for g, names in d["groups"].items():
            print(f"{g}: " + ", ".join(names))
        return 0
    if a.sprite:
        print(open(os.path.join(HERE, "..", "assets", "icons", "sprite.svg"), encoding="utf-8").read())
        return 0
    if not a.name:
        p.print_usage(sys.stderr)
        print("Укажи имя иконки. Список: python3 icon.py --list", file=sys.stderr)
        return 2
    if a.name not in d["icons"]:
        near = difflib.get_close_matches(a.name, list(d["icons"]), n=3)
        hint = f" Похожие: {', '.join(near)}." if near else ""
        print(f"Нет иконки «{a.name}».{hint} Список: python3 icon.py --list", file=sys.stderr)
        return 1
    # Подпись и класс экранируются: кавычка или < в --label не должны ломать разметку.
    aria = f'role="img" aria-label="{html.escape(a.label)}"' if a.label else 'aria-hidden="true"'
    print(f'<svg class="{html.escape(a.cls)}" width="{a.size}" height="{a.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
          f'stroke-width="{a.stroke}" stroke-linecap="round" stroke-linejoin="round" {aria}>{d["icons"][a.name]}</svg>')
    return 0

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):   # консоли Windows с cp1251/cp866 падают на «≈», «—», «₸»
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
