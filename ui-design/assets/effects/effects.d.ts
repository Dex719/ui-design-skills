// Типы для ui-design · effects.js (window.fx) — версия 2.
// Подключение в TypeScript: /// <reference path="./effects.d.ts" /> или добавь файл в "include".
// Для ESM-обёртки effects.mjs — effects.d.mts.

type FxDone = Promise<void>;
type FxTargets = Element | ArrayLike<Element> | null | undefined;
type FxPoint = { x: number; y: number };

interface FxBurstOptions {
  x?: number; y?: number;
  count?: number; colors?: string[]; speed?: number; life?: number; size?: number;
  gravity?: number; drag?: number; spread?: number; angle?: number;
  shape?: "dot" | "rect" | "spark";
}
interface FxLayerOptions { x: number; y: number; color?: string; ms?: number }
interface FxWaveOptions extends FxLayerOptions { size?: number; width?: number; squash?: number }
interface FxLinesOptions extends FxLayerOptions { count?: number; inner?: number; len?: number }
interface FxDamageOptions {
  x: number; y: number; value?: number | string;
  crit?: boolean; heal?: boolean; kind?: string; text?: string;
}
interface FxStampOptions { text: string; color?: string; shadow?: string; ms?: number; announce?: boolean }
interface FxToastOptions {
  duration?: number; className?: string;
}
interface FxToastElement extends HTMLDivElement { close(): void }
interface FxTrauma { add(amount: number): void; setIntensity(v: number): void }
interface FxCountUpOptions { from?: number; format?: (v: number) => string; duration?: number; punch?: boolean }
interface FxStrings {
  locale: string; done: string; copied: string; copiedLong: string; copyFailed: string; close: string;
  newNotifications: string; undo: string; deleted: string; sheetClose: string;
}

interface Fx {
  readonly version: string;

  /* режим движения и строки */
  reduced(): boolean;
  systemReduced(): boolean;
  setMotion(mode: "system" | "reduce" | "full"): void;
  setStrings(s: Partial<FxStrings>): void;
  center(el: Element): FxPoint;
  announce(text: string): void;

  /* формы и кнопки */
  shake(el: Element, opts?: { amp?: number; duration?: number }): FxDone;
  fieldError(field: HTMLElement, message: string, errorEl?: HTMLElement): void;
  clearFieldError(field: HTMLElement, errorEl?: HTMLElement): void;
  check(svg: SVGElement): void;
  loading(btn: HTMLElement, on: boolean, opts?: { label?: string }): void;
  success(btn: HTMLElement, opts?: { label?: string; reset?: number }): void;
  resetSuccess(btn: HTMLElement): void;
  copy(btn: HTMLElement, text: string, labelEl?: HTMLElement): void;
  pop(el: Element): FxDone;
  punch(el: Element, opts?: { scale?: number; ms?: number }): FxDone;
  punch(el: Element, scale?: number, ms?: number): FxDone;

  /* оверлеи и навигация */
  toast(message: string, opts?: FxToastOptions): FxToastElement;
  tabs(container: HTMLElement & { onTabChange?: (tab: HTMLElement) => void }): () => void;

  /* данные */
  countUp(el: HTMLElement, to: number, opts?: FxCountUpOptions): FxDone;
  countAll(selector?: string, root?: ParentNode): FxDone;
  stagger(list: Element): void;
  once(el: Element, cls: string, ms?: number): FxDone;
  sequence(selector?: string, root?: ParentNode): NodeListOf<HTMLElement>;
  flip(container: Element, mutate: () => void, opts?: { key?: (el: Element) => string | null; duration?: number }): FxDone;
  swap(el: Element, content: string, opts?: { html?: boolean } | boolean): FxDone;
  themeSwitch(apply: () => void, event?: { clientX: number; clientY: number }): FxDone;
  ring(bell: Element, opts?: { badge?: HTMLElement | null; count?: number }): FxDone;
  ring(bell: Element, badge?: HTMLElement | null, count?: number): FxDone;

  /* праздник */
  burst(el: Element, opts?: FxBurstOptions): FxDone;
  burst(opts: FxBurstOptions & FxPoint): FxDone;
  burst(x: number, y: number, opts?: FxBurstOptions): FxDone;
  confetti(target?: Element | (FxPoint & { colors?: string[]; count?: number })): FxDone;
  confetti(x: number, y: number, colors?: string[]): FxDone;
  flyTo(target: Element, opts?: { from?: Element | FxPoint; count?: number; onEach?: (i: number) => void }): FxDone;
  flyTo(fromX: number, fromY: number, target: Element, opts?: { count?: number; onEach?: (i: number) => void }): FxDone;

  /* игры */
  trauma(el: HTMLElement, opts?: { maxOffset?: number; maxAngle?: number; decay?: number; speed?: number; intensity?: number }): FxTrauma;
  hitFlash(el: Element): FxDone;
  hitstop(els: FxTargets, opts?: { ms?: number }): FxDone;
  hitstop(ms: number, els: FxTargets): FxDone;
  damageNumber(container: Element, opts: FxDamageOptions): FxDone;
  damageNumber(container: Element, x: number, y: number, value: number | string, opts?: Omit<FxDamageOptions, "x" | "y" | "value">): FxDone;
  health(bar: HTMLElement, value: number): FxDone;
  squashJump(el: HTMLElement, opts?: { height?: number; ms?: number } | number): FxDone;
  tint(el: Element, opts: { color?: string; ms?: number }): FxDone;
  tint(el: Element, color: string, ms?: number): FxDone;
  wave(layer: Element, opts: FxWaveOptions): FxDone;
  wave(layer: Element, x: number, y: number, opts?: Omit<FxWaveOptions, "x" | "y">): FxDone;
  lines(layer: Element, opts: FxLinesOptions): FxDone;
  lines(layer: Element, x: number, y: number, opts?: Omit<FxLinesOptions, "x" | "y">): FxDone;
  /** Не больше 3 вспышек в секунду: лишние вызовы пропускаются (WCAG 2.3.1). */
  flash(overlay: HTMLElement, opts?: { color?: string; alpha?: number; ms?: number }): FxDone;
  flash(overlay: HTMLElement, color: string, alpha?: number, ms?: number): FxDone;
  zoom(el: Element, opts?: { scale?: number; ms?: number }): FxDone;
  zoom(el: Element, scale: number, ms?: number): FxDone;
  slowmo(els: FxTargets, opts?: { rate?: number; ms?: number }): FxDone;
  slowmo(rate: number, ms: number, els?: FxTargets): FxDone;
  stamp(layer: Element, opts: FxStampOptions): FxDone;
  stamp(layer: Element, text: string, opts?: Omit<FxStampOptions, "text">): FxDone;
  afterimage(el: HTMLElement, opts?: { layer?: Element; color?: string; alpha?: number; ms?: number }): FxDone;
  afterimage(el: HTMLElement, layer: Element, opts?: { color?: string; alpha?: number; ms?: number }): FxDone;
  beam(layer: Element, opts: { x: number; width?: number; color?: string; ms?: number }): FxDone;
  beam(layer: Element, x: number, opts?: { width?: number; color?: string; ms?: number }): FxDone;
  jitter(el: Element, opts?: { ms?: number; amp?: number }): FxDone;
  jitter(el: Element, ms: number, amp?: number): FxDone;
}

interface Window { fx: Fx }
declare var fx: Fx;
