// Проверка типов effects.d.ts: tsc --noEmit --strict --lib dom,es2020 tests/fx-types.ts
/// <reference path="../ui-design/assets/effects/effects.d.ts" />

declare const el: HTMLElement;
declare const layer: HTMLElement;
declare const dlg: HTMLDialogElement;

async function check(): Promise<void> {
  // новая форма: цель + опции
  await fx.zoom(el, { scale: 1.1, ms: 300 });
  await fx.hitstop([el], { ms: 70 });
  await fx.slowmo(el, { rate: 0.3, ms: 400 });
  await fx.wave(layer, { x: 10, y: 20, size: 140 });
  await fx.damageNumber(layer, { x: 1, y: 2, value: 42, crit: true });
  await fx.flyTo(el, { from: { x: 0, y: 0 }, count: 4 });
  await fx.burst(el, { count: 8 });
  await fx.flash(layer, { color: "#fff", alpha: 0.3 });
  // краткая форма версии 1
  await fx.zoom(el, 1.06, 280);
  await fx.hitstop(70, [el]);
  await fx.slowmo(0.25, 600, [el]);
  await fx.wave(layer, 10, 20, { size: 140 });
  await fx.burst(10, 20, { count: 8 });
  await fx.ring(el, null, 3);
  // контроллеры
  const t = fx.trauma(el); t.add(0.4);
  const destroy = fx.tabs(el); destroy();
  fx.toast("Сохранено").close();
  const p: { x: number; y: number } = fx.center(el);
  void p; void dlg;
}
void check;
