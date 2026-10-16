#!/usr/bin/env python3
"""Пересобирает оглавления <!-- toc --> … <!-- /toc --> в главах references/*.md из их заголовков.

  python3 tools/build_toc.py           # обновить все оглавления
  python3 tools/build_toc.py --check   # только проверить (код 1, если какое-то устарело)

Глубина берётся из существующего оглавления: если в нём есть подпункты, включаются заголовки ###.
"""
import argparse
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = "**Оглавление** (читай только нужные разделы; поиск по заголовку):"


def build(text):
    m = re.search(r"<!-- toc -->(.*?)<!-- /toc -->", text, re.S)
    if not m:
        return text
    deep = any(ln.startswith("  - ") for ln in m.group(1).splitlines())
    items, fence = [], False
    for ln in text[m.end():].split("\n"):
        if ln.startswith("```"):
            fence = not fence
        if fence:
            continue
        h = re.match(r"^(#{2,3}) (.+)$", ln)
        if h and (len(h.group(1)) == 2 or deep):
            items.append(("" if len(h.group(1)) == 2 else "  ") + "- " + h.group(2).strip())
    block = "<!-- toc -->\n" + HEAD + "\n\n" + "\n".join(items) + "\n<!-- /toc -->"
    return text[:m.start()] + block + text[m.end():]


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check", action="store_true", help="ничего не писать; код 1, если оглавление устарело")
    a = p.parse_args(argv)
    stale = []
    for path in sorted(glob.glob(os.path.join(ROOT, "ui-design", "references", "*.md"))):
        with open(path, encoding="utf-8") as f:
            old = f.read()
        new = build(old)
        if new != old:
            stale.append(os.path.relpath(path, ROOT))
            if not a.check:
                with open(path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(new)
    verb = "Устарело" if a.check else "Обновлено"
    print(f"{verb}: {', '.join(stale)}" if stale else "Все оглавления актуальны.")
    return 1 if a.check and stale else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main(sys.argv[1:]))
