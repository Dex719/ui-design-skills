// Проверка доступности сайта и витрины эффектов (axe-core, WCAG 2.2 A/AA).
// Запуск: сервер на 127.0.0.1:8765 из корня репозитория, затем `node tests/a11y.mjs`.
// Нужны пакеты playwright и @axe-core/playwright (в CI ставятся без package.json).
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.A11Y_BASE || "http://127.0.0.1:8765";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAGES = [
  // «Без скилла» на главной - намеренно плохие примеры, они скрыты от скринридера и не проверяются
  { url: "/site/", exclude: [".col:not(.after) .stage"] },
  { url: "/ui-design/assets/effects/demo.html" },
  { url: "/ui-design/assets/effects/demo.html?lang=en" },
];

const browser = await chromium.launch();
let failed = 0;
for (const scheme of ["light", "dark"]) {
  for (const p of PAGES) {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ colorScheme: scheme, viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE + p.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      let axe = new AxeBuilder({ page }).withTags(TAGS);
      for (const sel of p.exclude || []) axe = axe.exclude(sel);
      const { violations } = await axe.analyze();
      const label = `${p.url} · ${scheme} · ${width}px`;
      if (violations.length) {
        failed += violations.length;
        console.log(`FAIL ${label}`);
        for (const v of violations) {
          console.log(`  ${v.id} (${v.impact}): ${v.help}`);
          for (const n of v.nodes.slice(0, 5)) console.log(`    ${n.target.join(" ")}\n      ${(n.failureSummary || "").split("\n").join(" ")}`);
        }
      } else console.log(`ok   ${label}`);
      await context.close();
    }
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
