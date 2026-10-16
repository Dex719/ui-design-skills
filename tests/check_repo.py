#!/usr/bin/env python3
"""Сверяет документацию с файлами: числа («118 иконок», «17 палитр»), пути к скриптам
и ассетам, ссылки на главы references/NN и API window.fx в README.

  python3 tests/check_repo.py      # код 1 и список расхождений, если что-то разошлось
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "ui-design")
DOCS = (glob.glob(os.path.join(ROOT, "*.md")) + glob.glob(os.path.join(SKILL, "*.md"))
        + glob.glob(os.path.join(SKILL, "references", "*.md")) + glob.glob(os.path.join(ROOT, "ui-design-slim", "*.md")))
DOCS = [d for d in DOCS if os.path.basename(d) != "REVIEW.md"]


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def main():
    errors = []
    icons = json.load(open(os.path.join(SKILL, "assets", "icons", "icons.json"), encoding="utf-8"))["icons"]
    svgs = glob.glob(os.path.join(SKILL, "assets", "icons", "lucide", "*.svg"))
    sprite = read(os.path.join(SKILL, "assets", "icons", "sprite.svg")).count("<symbol")
    if not len(icons) == len(svgs) == sprite:
        errors.append(f"иконки: icons.json {len(icons)}, svg {len(svgs)}, sprite {sprite}")
    palettes = glob.glob(os.path.join(SKILL, "assets", "palettes", "*.css"))
    js = read(os.path.join(SKILL, "assets", "effects", "effects.js"))
    api = set(re.findall(r"(\w+):\s*\w+", re.search(r"window\.fx\s*=\s*\{(.*?)\};", js, re.S).group(1)))

    claims = [
        (r"\b(\d+)\s+(?:SVG-иконок|иконок|icons|SVG files)\b", len(icons), "иконок"),
        (r"\b(\d+)\s+(?:примеров палитр|палитр|calibration palettes)\b", len(palettes), "палитр"),
    ]
    for doc in DOCS:
        text, rel = read(doc), os.path.relpath(doc, ROOT)
        for rx, real, what in claims:
            for m in re.finditer(rx, text):
                if int(m.group(1)) != real:
                    errors.append(f"{rel}: «{m.group(0)}», а {what} {real}")
        for m in re.finditer(r"`((?:scripts|assets|references)/[\w./-]+?)`", text):
            path = m.group(1).rstrip(".")
            if "<" in path or "*" in path:
                continue
            base = os.path.join(ROOT, path) if rel.startswith(("README", "ui-design/")) and path.startswith("ui-design") else os.path.join(SKILL, path)
            if not os.path.exists(base) and not glob.glob(base + "*"):
                errors.append(f"{rel}: нет файла `{path}`")
        for m in re.finditer(r"references/(\d{2})\b", text):
            if not glob.glob(os.path.join(SKILL, "references", m.group(1) + "-*.md")):
                errors.append(f"{rel}: нет главы references/{m.group(1)}")

    for readme in ("README.md", "README.ru.md"):
        listed = set(re.findall(r"`(\w+)",re.search(r"window\.fx.*?\n## ", read(os.path.join(ROOT, readme)), re.S).group(0)))
        missing = sorted(api - listed - {"fx"})
        if missing:
            errors.append(f"{readme}: в списке эффектов нет {', '.join(missing)}")

    for e in errors:
        print(e)
    print(f"Проверено документов: {len(DOCS)}; расхождений: {len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
