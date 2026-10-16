# UI Design Skills для Claude

[English](README.md) · **Русский**

Два [скилла (Agent Skills)](https://docs.claude.com/en/docs/agents-and-tools/agent-skills), которые учат Claude (Claude Code, Claude.ai, Claude Agent SDK) проектировать, верстать и ревьюить интерфейсы: сайты и лендинги, мобильные и десктопные приложения, дашборды, игровой UI (HUD, меню, геймпад, game feel).

Сами скиллы написаны на **русском**; Claude читает их и отвечает на том языке, на котором вы спрашиваете.

| Скилл | Что это | Размер |
|---|---|---|
| [`ui-design/`](ui-design) | Полная версия: процесс, 27 правил, 23 главы справочника, Python-инструменты, библиотека эффектов, палитры, иконки | ~730 КБ, 180 файлов |
| [`ui-design-slim/`](ui-design-slim) | Компактная шпаргалка в одном файле: ключевые правила и числа, без инструментов | 1 файл, ~19 КБ |

Ставьте один из двух, не оба сразу: описания-триггеры у них пересекаются.

## Что делает скилл

Когда вы просите у Claude экран, страницу, компонент или ревью дизайна, скилл заставляет его идти по процессу, а не выдавать шаблонный «ИИ-шный» интерфейс:

1. **Сначала контекст** — тип продукта, платформа, одно главное действие на экране, аудитория.
2. **Система до экранов** — дизайн-система выводится из брифа (плотность → размеры и шкала шрифта → отступы → формы → цвет → глубина → движение), у каждого значения записана *причина*. Собираются 2–3 варианта, различающиеся минимум по трём осям, и показываются рядом.
3. **Структура до стиля** — контент → иерархия → сетка → типографика → цвет → изображения → анимация.
4. **Все состояния** — пусто, загрузка, ошибка, офлайн, крайние данные, фокус с клавиатуры и геймпада.
5. **Аудит** по чек-листу перед сдачей.

Характерные правила: никаких эмодзи (только SVG-иконки), никакой *анимации* по наведению по умолчанию (только смена цвета), всё через токены в светлой и тёмной теме, один акцент ≤ 10% экрана, без индиго и бирюзы «по привычке», движение — обязательный, но сдержанный слой с уважением к `prefers-reduced-motion`.

## На чём основан

**Источники знаний** (полный список — [`ui-design/references/SOURCES.md`](ui-design/references/SOURCES.md)):

- Юзабилити и когнитивная психология — Круг «Не заставляйте меня думать», Норман «Дизайн привычных вещей», законы UX (Фиттс, Хик, Якоб, Миллер/Коуэн, Теслер, Доэрти), гештальт, 10 эвристик Нильсена, исследования NN/g.
- Визуальный дизайн — принципы CRAP, *Refactoring UI*, Брингхерст о типографике, Тидвелл *Designing Interfaces*.
- Стандарты и гайдлайны платформ — **WCAG 2.2**, Material Design 3, Apple Human Interface Guidelines, Xbox Accessibility Guidelines, Game Accessibility Guidelines, Core Web Vitals, формат токенов **DTCG**, EAA / DSA / FTC о тёмных паттернах.
- Игровой UX — Swink *Game Feel*, Hodent *The Gamer's Brain*.

**Технологии во встроенных инструментах:**

| Область | Что используется |
|---|---|
| Цвет | Цветовое пространство **OKLCH**, тонированные нейтрали в духе Radix, формула контраста WCAG 2 |
| Шрифты | Google Fonts (онлайн) или пакеты `@fontsource`, встроенные в base64 (офлайн) |
| Иконки | **Lucide** (лицензия ISC), 127 иконок inline-SVG и спрайтом `<symbol>` |
| Движение | Web Animations API, CSS-переходы, FLIP, `prefers-reduced-motion` + ручной режим `data-motion` |
| Скрипты | Python 3, **только стандартная библиотека** — `pip install` не нужен |
| Эффекты | Чистый JS + CSS, без зависимостей |

## Состав `ui-design/`

```
ui-design/
├── SKILL.md          вход: процесс, 27 золотых правил, ключевые числа, формат результата
├── MAP.md            mind map, маршруты по задачам («лендинг: 23 → 03 → 11 → …»), указатель тем
├── references/       23 главы, читаются по необходимости
├── scripts/          Python-утилиты командной строки
└── assets/
    ├── effects/      effects.css + effects.js (window.fx) + demo.html
    ├── palettes/     17 палитр для калибровки (светлая + тёмная)
    ├── icons/        SVG Lucide, icons.json, sprite.svg, лицензия
    └── styles/       system.example.json — пример описания дизайн-системы
```

### Главы справочника

| № | Тема | № | Тема |
|---|---|---|---|
| 01 | Основы юзабилити, время отклика | 13 | Тексты интерфейса, локализация, RTL, плюралы |
| 02 | Законы UX, гештальт, эвристики Нильсена | 14 | Графики и дашборды |
| 03 | Визуальная иерархия, отступы, тени, радиусы | 15 | Доверие, тёмные паттерны, ИИ-функции |
| 04 | Цвет, контраст, тёмная тема | 16 | Дизайн-система и токены (DTCG) |
| 05 | Типографика, кириллица, ₸ | 17 | Аудит и юзабилити-тесты |
| 06 | Сетки, брейкпоинты, container queries | 18 | Игровой UI, HUD, safe area, геймпад |
| 07 | Навигация, формы, состояния, тосты, модалки | 19 | Game feel, онбординг, доступность игр |
| 08 | Анимация и взаимодействие | 20 | Цветовые палитры |
| 09 | Фото, арт-дирекшн, иконки | 21 | Микровзаимодействия и каталог эффектов |
| 10 | Медиа и производительность (CWV, srcset, OG) | 22 | Игровые VFX и «juice» |
| 11 | Лендинги и веб-стиль | 23 | Дизайн-система с нуля |
| 12 | Доступность (WCAG 2.2, ARIA, EAA) | | |

### Инструменты

Запускаются из любой папки, пути передаются аргументами:

```bash
# Палитра: один акцент + тонированные нейтрали, светлая и тёмная тема, контраст подгоняется сам
python3 ui-design/scripts/make_palette.py --hue 215 --chroma 0.11 --name brand

# Проверка контраста: одна пара или все токены в CSS/HTML-файле
python3 ui-design/scripts/check_contrast.py "#1c2024" "#f9f9fb"
python3 ui-design/scripts/check_contrast.py ui-design/assets/palettes/forest.css

# Style tiles: 2–3 варианта дизайн-системы рядом, потом экспорт выбранного
python3 ui-design/scripts/style_tiles.py a.json b.json c.json -o tiles.html
python3 ui-design/scripts/style_tiles.py --export a.json -d ./design   # design-system.css + DESIGN.md

# Иконки вместо эмодзи
python3 ui-design/scripts/icon.py --list
python3 ui-design/scripts/icon.py trash-2 --label "Удалить"

# Добавить в CSS ручной режим «полное движение»
python3 ui-design/scripts/build_motion_override.py effects.css

# Пересобрать 17 примеров палитр и их таблицу из assets/palettes/palettes.json
python3 ui-design/scripts/build_palettes.py
```

В Windows вместо `python3` — `python` или `py -3`. У каждого скрипта есть `--help`; код выхода 1 — проверка не прошла, 2 — неверный ввод.

Схема `system.json` описана в `references/23`, раздел 8; пример — [`assets/styles/system.example.json`](ui-design/assets/styles/system.example.json).

### Библиотека эффектов (`window.fx`)

Подключите `effects.css` и `effects.js` и вызывайте `fx.*`. Каждый эффект проверяет «уменьшить движение» и в этом режиме сохраняет смысл (цвет, текст, `aria-live`), но убирает движение. Живая витрина — [`assets/effects/demo.html`](ui-design/assets/effects/demo.html).

- **Формы и UI:** `shake`, `fieldError`, `clearFieldError`, `check`, `loading`, `success`, `resetSuccess`, `copy`, `toast`, `announce`, `tabs`, `ring`, `pop`, `punch`
- **Данные и раскладка:** `countUp`, `countAll`, `stagger`, `once`, `flip`, `swap`, `themeSwitch`, `sequence`
- **Награды:** `burst`, `confetti`, `flyTo`
- **Игры:** `trauma`, `hitFlash`, `hitstop`, `jitter`, `damageNumber`, `health`, `tint`, `wave`, `lines`, `flash`, `zoom`, `slowmo`, `stamp`, `afterimage`, `beam`, `squashJump`
- **Режим движения и строки:** `reduced()`, `systemReduced()`, `setMotion("system" | "reduce" | "full")`, `setStrings({ done: "Done", … })` для интерфейсов не на русском

## Установка

**Claude Code** — скопируйте папку скилла в папку скиллов:

```bash
# личные (для всех проектов)
cp -r ui-design ~/.claude/skills/
# или только для проекта
cp -r ui-design .claude/skills/
```

В Windows личная папка — `%USERPROFILE%\.claude\skills\`.

**Claude.ai / Claude Desktop** — заархивируйте папку скилла (в zip должна лежать папка с `SKILL.md` внутри) и загрузите в *Settings → Capabilities → Skills*.

Claude подхватывает скилл сам, когда вы спрашиваете про UI, UX, лендинги, экраны приложений, игровой UI, дизайн-системы или доступность. Можно вызвать и по имени: `/ui-design` или `/ui-design-slim`.

## Проверки

[`.github/workflows/check.yml`](.github/workflows/check.yml) запускается на Linux, Windows и macOS с Python 3.9 и 3.13: `--help` у каждого скрипта, пересборка и сравнение палитр, контраст всех палитр в обеих темах, пример системы с `--strict`, блок ручного режима движения и [`tests/check_repo.py`](tests/check_repo.py) — сверка чисел и путей в документации с файлами. Локально:

```bash
python3 tests/check_repo.py
```

## Лицензии

Сторонние материалы перечислены в [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md):

- Иконки Lucide — ISC, см. [`ui-design/assets/icons/LICENSE-lucide.txt`](ui-design/assets/icons/LICENSE-lucide.txt).
- Нейтрали и статусные цвета Radix Colors в `make_palette.py` и палитрах — MIT.
- Шрифты в репозиторий не входят: грузятся с Google Fonts или из вашего `@fontsource`.
- Для остального содержимого файла лицензии пока нет.
