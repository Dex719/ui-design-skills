# Third-party notices

This repository includes or derives material from the following projects.

## Lucide icons — ISC

`ui-design/assets/icons/` (127 SVG files, `icons.json`, `sprite.svg`) are taken from
[Lucide](https://lucide.dev). Full license text: [`ui-design/assets/icons/LICENSE-lucide.txt`](ui-design/assets/icons/LICENSE-lucide.txt).

## Radix Colors — MIT

The neutral scales (gray, slate, sand, mauve, sage, olive — steps 1–12, light and dark) and the
status colors (red, green, amber — steps 3 and 11) in `ui-design/scripts/make_palette.py`, and the
palettes generated from them in `ui-design/assets/palettes/`, come from
[Radix Colors](https://github.com/radix-ui/colors).

```
MIT License

Copyright (c) 2022 WorkOS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts — not bundled

No font files are included. `style_tiles.py` and `demo.html` load fonts from Google Fonts, and
`style_tiles.py --embed-fonts` embeds files from your own `@fontsource` install. These fonts are
distributed under the SIL Open Font License 1.1 by their authors.

## Icon sets referenced but not bundled

The skill text recommends Tabler (MIT), Phosphor (MIT), Material Symbols (Apache 2.0),
game-icons.net (CC BY 3.0 — attribution required) and Kenney (CC0). None of their files are
included here.
