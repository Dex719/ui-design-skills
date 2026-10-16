#!/usr/bin/env python3
"""Пересобирает примеры палитр из одного источника — assets/palettes/palettes.json.

Каждый пример = команда make_palette.py. Скрипт пишет assets/palettes/<id>.css и
таблицу в references/20-color-palettes.md (между маркерами palettes:begin/end),
так что файлы, таблица и команды не могут разойтись.

  python3 build_palettes.py           # пересобрать всё
  python3 build_palettes.py --check   # только сравнить (для CI): код 1, если что-то устарело
"""
import argparse
import json
import os
import re
import shlex
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from make_palette import build, css, neutral_for_hue, parser, report  # noqa: E402

MANIFEST = os.path.join(ROOT, "assets", "palettes", "palettes.json")
DOC = os.path.join(ROOT, "references", "20-color-palettes.md")
BEGIN, END = "<!-- palettes:begin (генерирует scripts/build_palettes.py) -->", "<!-- palettes:end -->"


def render(entry):
    a = parser().parse_args(shlex.split(entry["args"]) + ["--name", entry["id"]])
    neutral = neutral_for_hue(a.hue) if a.neutral == "auto" else a.neutral
    t = build(a.hue, a.chroma, neutral, a.max_l, a.bright, a.bg, a.tint)
    rep, fails = report(t)
    if fails:
        raise SystemExit(f"{entry['id']}: {fails} пар не проходят контраст")
    return t, neutral, css(t, a.name, a.dark_first) + "\n" + f"/* нейтрали: {neutral} (Radix) */\n{rep}\n"


def table(rows):
    out = ["| id | Настроение | Где | Нейтрали | Акцент светлая / тёмная | Команда |",
           "|---|---|---|---|---|---|"]
    for e, t, neutral in rows:
        out.append(f"| `{e['id']}` | {e['mood']} | {e['where']} | {neutral} | "
                   f"`{t['light']['accent']}` / `{t['dark']['accent']}` | `{e['args']}` |")
    return "\n".join(out)


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check", action="store_true", help="ничего не писать, только сравнить с файлами")
    a = p.parse_args(argv)
    with open(MANIFEST, encoding="utf-8") as f:
        entries = json.load(f)

    stale, rows = [], []
    for e in entries:
        t, neutral, text = render(e)
        rows.append((e, t, neutral))
        path = os.path.join(ROOT, "assets", "palettes", e["id"] + ".css")
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        if old.replace("\r\n", "\n") != text:
            stale.append(os.path.relpath(path, ROOT))
            if not a.check:
                with open(path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)

    with open(DOC, encoding="utf-8") as f:
        doc = f.read().replace("\r\n", "\n")
    block = f"{BEGIN}\n{table(rows)}\n{END}"
    new_doc = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), lambda _: block, doc, flags=re.S)
    if BEGIN not in doc:
        raise SystemExit(f"В {DOC} нет маркера {BEGIN}")
    if new_doc != doc:
        stale.append(os.path.relpath(DOC, ROOT))
        if not a.check:
            with open(DOC, "w", encoding="utf-8", newline="\n") as f:
                f.write(new_doc)

    known = {e["id"] + ".css" for e in entries}
    extra = sorted(f for f in os.listdir(os.path.join(ROOT, "assets", "palettes"))
                   if f.endswith(".css") and f not in known)
    for f in extra:
        print(f"Файл без записи в palettes.json: assets/palettes/{f}")

    verb = "Устарело" if a.check else "Обновлено"
    print(f"{verb}: {', '.join(stale)}" if stale else f"Все {len(entries)} палитр совпадают с palettes.json.")
    return 1 if a.check and (stale or extra) else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main(sys.argv[1:]))
