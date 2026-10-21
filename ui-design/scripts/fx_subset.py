#!/usr/bin/env python3
"""Собирает из библиотеки эффектов только нужное: выбранные функции fx.* со всеми их
вспомогательными функциями и только те правила effects.css, которые им нужны.

  python3 fx_subset.py --list                          # что можно выбрать
  python3 fx_subset.py --only toast,copy               # только посчитать вес
  python3 fx_subset.py --only toast,copy -o ./fx       # записать fx/fx.js и fx/fx.css
  python3 fx_subset.py --only shake,skeleton -o ./fx   # skeleton - эффект только на CSS (.fx-skeleton)

Зачем: в одностраничный файл копируют только используемые эффекты (SKILL.md, «Встраивай только нужное»).
Вся библиотека утяжеляет страницу в 3-5 раз. В подмножестве остаются fx.reduced, fx.setMotion и
fx.setStrings, «уменьшить движение» работает так же, как в полной версии.
"""
import argparse, difflib, gzip, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FX = os.path.join(HERE, "..", "assets", "effects")
ALWAYS = ["reduced", "systemReduced", "setMotion", "setStrings"]

DECL = re.compile(r"^  (?:function ([A-Za-z_$][\w$]*)\s*\(|var\s|window\.fx\s*=|Object\.keys\(window\.fx\))")
IDENT = re.compile(r"[A-Za-z_$][\w$]*")


def strip_code(text):
    """Комментарии и строки не считаются зависимостями (в строках бывают слова вроде done)."""
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    text = re.sub(r"(?m)//.*$", " ", text)
    return re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", '""', text)


def split_js(js):
    """Тело IIFE -> пролог, список кусков (имена, текст), блок экспорта, обёртка, эпилог."""
    lines = js.split("\n")
    starts = []
    for i, ln in enumerate(lines):
        if DECL.match(ln):
            j = i
            # комментарий над объявлением принадлежит ему
            if j > 0 and lines[j - 1].rstrip().endswith("*/"):
                j -= 1
                while j > 0 and "/*" not in lines[j]:
                    j -= 1
            starts.append(j)
    end = max(i for i, ln in enumerate(lines) if ln.startswith("})();"))
    pieces = []
    for k, st in enumerate(starts):
        stop = starts[k + 1] if k + 1 < len(starts) else end
        pieces.append("\n".join(lines[st:stop]))
    prolog = "\n".join(lines[:starts[0]])
    epilog = "\n".join(lines[end:])
    chunks, export, wrapper = [], None, None
    for text in pieces:
        code = strip_code(text)
        if re.search(r"(?m)^  window\.fx\s*=", text):
            export = text
            continue
        if re.search(r"(?m)^  Object\.keys\(window\.fx\)", text):
            wrapper = text
            continue
        m = re.search(r"(?m)^  function ([A-Za-z_$][\w$]*)", code)
        if m:
            names = [m.group(1)]
        else:
            first = re.search(r"(?m)^  var\s+(.*)$", code).group(1)
            names = re.findall(r"(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?==|,|;|$)", first)
        chunks.append({"names": names, "text": text, "deps": set(IDENT.findall(code))})
    return prolog, chunks, export, wrapper, epilog


def public_api(export):
    body = re.search(r"\{(.*)\}", export, re.S).group(1)
    version = re.search(r'version:\s*"([^"]+)"', body).group(1)
    pairs = dict(re.findall(r"([A-Za-z_$][\w$]*):\s*([A-Za-z_$][\w$]*)", body))
    pairs.pop("version", None)
    return version, pairs


def build_js(js, wanted):
    prolog, chunks, export, wrapper, epilog = split_js(js)
    version, api = public_api(export)
    by_name = {n: c for c in chunks for n in c["names"]}
    keep, todo = set(), [api[n] for n in wanted + ALWAYS]
    if wrapper:
        todo += [t for t in IDENT.findall(strip_code(wrapper)) if t in by_name]
    while todo:
        n = todo.pop()
        c = by_name.get(n)
        if c is None or id(c) in keep:
            continue
        keep.add(id(c))
        todo += [d for d in c["deps"] if d in by_name]
    names = [n for n in api if n in wanted or n in ALWAYS]
    out_export = "  window.fx = {\n    version: \"%s\",\n    %s\n  };" % (
        version, ", ".join("%s: %s" % (n, api[n]) for n in names))
    parts = [prolog.rstrip("\n")]
    parts += [c["text"].rstrip("\n") for c in chunks if id(c) in keep]
    parts.append(out_export)
    if wrapper:
        parts.append(wrapper.rstrip("\n"))
    head = "/* ui-design · effects.js, подмножество: %s */\n" % ", ".join(wanted)
    return head + "\n\n".join(parts) + "\n" + epilog


def css_blocks(css):
    """Верхний уровень CSS: [("comment", текст) | ("rule", прелюдия, тело)]."""
    out, i, n = [], 0, len(css)
    while i < n:
        if css.startswith("/*", i):
            j = css.index("*/", i) + 2
            out.append(("comment", css[i:j]))
            i = j
            continue
        if css[i].isspace():
            i += 1
            continue
        j = css.find("{", i)
        if j < 0:
            break
        depth, k = 0, j
        while k < n:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
                if depth == 0:
                    break
            k += 1
        out.append(("rule", css[i:j].strip(), css[j + 1:k]))
        i = k + 1
    return out


def split_selectors(sel):
    parts, depth, cur = [], 0, ""
    for ch in sel:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    parts.append(cur.strip())
    return [p for p in parts if p]


def filter_css(css, used):
    res = []
    for b in css_blocks(css):
        if b[0] == "comment":
            continue
        pre, body = b[1], b[2]
        if pre.startswith("@keyframes"):
            res.append(("kf", pre.split()[1], "%s{%s}" % (pre, body)))
        elif pre.startswith("@"):
            inner = filter_css(body, used)
            if inner.strip():
                res.append(("at", pre, "%s{\n%s\n}" % (pre, inner)))
        else:
            keep = [s for s in split_selectors(pre) if set(re.findall(r"\.(fx-[\w-]+)", s)) <= used]
            if keep:
                res.append(("rule", None, "%s{%s}" % (", ".join(keep), body)))
    kept = "\n".join(t for k, _, t in res if k != "kf")
    # @keyframes оставляем, только если их имя встречается в оставленных правилах
    return "\n".join(t for k, name, t in res if k != "kf" or re.search(r"\b%s\b" % re.escape(name), kept))


def build_css(css, js_subset, extra):
    used = set(re.findall(r"fx-[\w-]+", js_subset)) | {"fx-" + e for e in extra}
    return "/* ui-design · effects.css, подмножество */\n" + filter_css(css, used) + "\n"


def size(text):
    raw = text.encode("utf-8")
    return len(raw), len(gzip.compress(raw, 9))


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--only", metavar="ИМЕНА", help="функции fx и CSS-эффекты через запятую: toast,copy,skeleton")
    p.add_argument("-o", "--out", metavar="ПАПКА", help="куда записать fx.js и fx.css")
    p.add_argument("--list", action="store_true", help="что можно выбрать")
    a = p.parse_args(argv)
    js = open(os.path.join(FX, "effects.js"), encoding="utf-8").read().replace("\r\n", "\n")
    css = open(os.path.join(FX, "effects.css"), encoding="utf-8").read().replace("\r\n", "\n")
    _, chunks, export, _, _ = split_js(js)
    _, api = public_api(export)
    js_classes = set(re.findall(r"fx-[\w-]+", js))
    css_only = sorted({c[3:] for c in re.findall(r"\.(fx-[\w-]+)", css)} - {c[3:] for c in js_classes})
    if a.list:
        print("Функции fx: " + ", ".join(n for n in api if n not in ALWAYS))
        print("Эффекты только на CSS: " + ", ".join(css_only))
        return 0
    if not a.only:
        p.error("укажите --only или --list")
    wanted = [w.strip() for w in a.only.split(",") if w.strip()]
    funcs = [w for w in wanted if w in api]
    extra = [w for w in wanted if w not in api]
    bad = [w for w in extra if w not in css_only]
    if bad:
        for w in bad:
            hint = difflib.get_close_matches(w, list(api) + css_only, 1)
            print("Нет такого эффекта: %s%s" % (w, " (может быть, %s?)" % hint[0] if hint else ""), file=sys.stderr)
        return 2
    sub_js = build_js(js, funcs)
    sub_css = build_css(css, sub_js, extra)
    fj, fc = size(js), size(css)
    sj, sc = size(sub_js), size(sub_css)
    print("JS:  %6d Б (gzip %5d Б) из %d Б" % (sj[0], sj[1], fj[0]))
    print("CSS: %6d Б (gzip %5d Б) из %d Б" % (sc[0], sc[1], fc[0]))
    print("Всего gzip: %d Б, %d%% полной библиотеки" % (sj[1] + sc[1], round(100 * (sj[1] + sc[1]) / (fj[1] + fc[1]))))
    if a.out:
        os.makedirs(a.out, exist_ok=True)
        open(os.path.join(a.out, "fx.js"), "w", encoding="utf-8", newline="\n").write(sub_js)
        open(os.path.join(a.out, "fx.css"), "w", encoding="utf-8", newline="\n").write(sub_css)
        print("ok " + os.path.join(a.out, "fx.js") + ", fx.css")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main(sys.argv[1:]))
