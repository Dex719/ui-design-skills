# UI Design Skills for Claude

**English** · [Русский](README.ru.md)

Two [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills) that teach Claude (Claude Code, Claude.ai, Claude Agent SDK) how to design, build and review user interfaces: websites and landing pages, mobile and desktop apps, dashboards, and game UI (HUD, menus, gamepad, game feel).

The skill content itself is written in **Russian**; Claude reads it and answers in whatever language you use.

| Skill | What it is | Size |
|---|---|---|
| [`ui-design/`](ui-design) | Full version: process, 27 rules, 27 reference chapters, Python tools, effects library, palettes, icons | ~730 KB, 180 files |
| [`ui-design-slim/`](ui-design-slim) | Compact single-file cheat sheet with the key rules and numbers, no tools | 1 file, ~19 KB |

Install one of them, not both: their trigger descriptions overlap.

## What the skill does

When you ask Claude for a screen, a page, a component or a design review, the skill makes it follow a fixed process instead of producing a generic "AI-looking" UI:

1. **Context first** — product type, platform, the one main action on the screen, audience.
2. **System before screens** — derive a design system from the brief (density → type size and scale → spacing → shape → color → depth → motion), with a written *reason* for every value. Build 2–3 variants that differ on at least three axes and show them side by side.
3. **Structure before style** — content → hierarchy → grid → typography → color → imagery → motion.
4. **All states** — empty, loading, error, offline, extreme data, keyboard/gamepad focus.
5. **Audit** against a checklist before handing off.

Notable house rules: no emoji anywhere (real SVG icons instead), no hover *motion* by default (only color changes), everything from tokens in both light and dark themes, one accent ≤ 10% of the screen, no "indigo/teal by habit" palettes, motion as a mandatory but restrained layer that respects `prefers-reduced-motion`.

## What it is built on

**Knowledge sources** (full list in [`ui-design/references/SOURCES.md`](ui-design/references/SOURCES.md)):

- Usability and cognitive psychology — Krug *Don't Make Me Think*, Norman *The Design of Everyday Things*, Laws of UX (Fitts, Hick, Jakob, Miller/Cowan, Tesler, Doherty), Gestalt, Nielsen's 10 heuristics, NN/g research.
- Visual design — CRAP principles, *Refactoring UI*, Bringhurst on typography, Tidwell *Designing Interfaces*.
- Standards and platform guidelines — **WCAG 2.2**, Material Design 3, Apple Human Interface Guidelines, Xbox Accessibility Guidelines, Game Accessibility Guidelines, Core Web Vitals, **DTCG design tokens** format, EAA / DSA / FTC on dark patterns.
- Game UX — Swink *Game Feel*, Hodent *The Gamer's Brain*.

**Tech used by the bundled tools:**

| Area | What |
|---|---|
| Color | **OKLCH** color space, Radix-style tinted neutral scales, WCAG 2 contrast math |
| Fonts | Google Fonts (online) or `@fontsource` packages embedded as base64 (offline) |
| Icons | **Lucide** (ISC license), 127 icons as inline SVG and a `<symbol>` sprite |
| Motion | Web Animations API, CSS transitions, FLIP, `prefers-reduced-motion` + manual `data-motion` override |
| Scripts | Python 3, **standard library only** — no `pip install` needed |
| Effects | Vanilla JS + CSS, zero dependencies |

## Contents of `ui-design/`

```
ui-design/
├── SKILL.md          entry point: process, 27 golden rules, key numbers, output format
├── MAP.md            mind map, task routes ("landing page: read 23 → 03 → 11 → …"), topic index
├── references/       27 chapters, read on demand
├── scripts/          Python CLI tools
└── assets/
    ├── effects/      effects.css + effects.js (window.fx) + demo.html
    ├── palettes/     17 calibration palettes (light + dark)
    ├── icons/        Lucide SVGs, icons.json, sprite.svg, license
    └── styles/       system.example.json — sample design-system spec
```

### Reference chapters

| # | Topic | # | Topic |
|---|---|---|---|
| 01 | Usability foundations, response times | 13 | UX writing, i18n, RTL, plurals |
| 02 | UX laws, Gestalt, Nielsen heuristics | 14 | Data viz and dashboards |
| 03 | Visual hierarchy, spacing, shadows, radii | 15 | Trust, dark patterns, AI features |
| 04 | Color, contrast, dark mode | 16 | Design system and tokens (DTCG) |
| 05 | Typography, Cyrillic, ₸ | 17 | Audit and usability testing |
| 06 | Layout, grids, breakpoints, container queries | 18 | Game UI, HUD, safe areas, gamepad |
| 07 | Navigation, forms, screen states, toasts, modals | 19 | Game feel, onboarding, game accessibility |
| 08 | Motion and interaction | 20 | Color palettes |
| 09 | Imagery, art direction, icons | 21 | Micro-interactions and effects catalog |
| 10 | Web media and performance (CWV, srcset, OG) | 22 | Game VFX and "juice" |
| 11 | Landing pages and web style | 23 | Design system from scratch |
| 12 | Accessibility (WCAG 2.2, ARIA, EAA) | 24 | AI interfaces: chat, streaming, sources, agents |
| 26 | Modern CSS and accessibility modes | 25 | Forms: autofill, passkeys, OTP, KZ formats, ₸, dates, files |
| 27 | Data tables | | |

### Tools

Run them from anywhere, passing paths as arguments:

```bash
# Palette: one accent + tinted neutrals, light + dark theme, contrast auto-fixed
python3 ui-design/scripts/make_palette.py --hue 215 --chroma 0.11 --name brand

# Contrast check: a single pair, or all tokens in a CSS/HTML file
python3 ui-design/scripts/check_contrast.py "#1c2024" "#f9f9fb"
python3 ui-design/scripts/check_contrast.py ui-design/assets/palettes/forest.css

# Style tiles: render 2–3 design-system variants side by side, then export the chosen one
python3 ui-design/scripts/style_tiles.py a.json b.json c.json -o tiles.html
python3 ui-design/scripts/style_tiles.py --export a.json -d ./design   # design-system.css + DESIGN.md

# Icons instead of emoji
python3 ui-design/scripts/icon.py --list
python3 ui-design/scripts/icon.py trash-2 --label "Delete"

# Add a manual "full motion" override block to a CSS file
python3 ui-design/scripts/build_motion_override.py effects.css

# Rebuild the 17 example palettes and their table from assets/palettes/palettes.json
python3 ui-design/scripts/build_palettes.py
```

On Windows use `python` or `py -3` instead of `python3`. Every script has `--help`; exit code 1 means a check failed, 2 means bad input.

`system.json` schema is described in `references/23`, section 8; see [`assets/styles/system.example.json`](ui-design/assets/styles/system.example.json).

### Effects library (`window.fx`)

Include `effects.css` and `effects.js`, then call `fx.*`. Every effect checks reduced-motion and, when it is on, keeps the meaning (color, text, `aria-live`) but drops the movement. Open [`assets/effects/demo.html`](ui-design/assets/effects/demo.html) for a live showcase.

- **Forms and UI:** `shake`, `fieldError`, `clearFieldError`, `check`, `loading`, `success`, `resetSuccess`, `copy`, `toast`, `announce`, `tabs`, `ring`, `pop`, `punch`
- **Data and layout:** `countUp`, `countAll`, `stagger`, `once`, `flip`, `swap`, `themeSwitch`, `sequence`
- **Celebration:** `burst`, `confetti`, `flyTo`
- **Games:** `trauma`, `hitFlash`, `hitstop`, `jitter`, `damageNumber`, `health`, `tint`, `wave`, `lines`, `flash`, `zoom`, `slowmo`, `stamp`, `afterimage`, `beam`, `squashJump`
- **Motion mode and strings:** `reduced()`, `systemReduced()`, `setMotion("system" | "reduce" | "full")`, `setStrings({ done: "Done", … })` for non-Russian UIs

## Installation

**Claude Code** — copy the skill folder into your skills directory:

```bash
# personal (all projects)
cp -r ui-design ~/.claude/skills/
# or project-only
cp -r ui-design .claude/skills/
```

On Windows the personal folder is `%USERPROFILE%\.claude\skills\`.

**Claude.ai / Claude Desktop** — zip the skill folder (the zip must contain the folder with `SKILL.md` inside) and upload it in *Settings → Capabilities → Skills*.

Claude picks the skill up automatically when you ask about UI, UX, landing pages, app screens, game UI, design systems or accessibility. You can also call it by name: `/ui-design` or `/ui-design-slim`.

## Checks

[`.github/workflows/check.yml`](.github/workflows/check.yml) runs on Linux, Windows and macOS with Python 3.9 and 3.13: every script's `--help`, palettes regenerated and compared, contrast of all palettes in both themes, the example system with `--strict`, the motion override block, and [`tests/check_repo.py`](tests/check_repo.py), which checks that numbers and paths in the docs match the files. Run the same locally:

```bash
python3 tests/check_repo.py
```

## Licenses

Third-party material is listed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md):

- Lucide icons — ISC, see [`ui-design/assets/icons/LICENSE-lucide.txt`](ui-design/assets/icons/LICENSE-lucide.txt).
- Radix Colors neutral and status scales in `make_palette.py` and the palettes — MIT.
- Fonts are not bundled; they load from Google Fonts or from your own `@fontsource` install.
- The rest of the repository has no license file yet.
