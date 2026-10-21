/* ui-design · библиотека эффектов (JS, без зависимостей)
   Подключение: effects.css + этот файл. API: window.fx.*
   Каждая функция сама проверяет «уменьшить движение» и в этом режиме
   оставляет смысл (цвет, текст, aria-live), но убирает движение. */
(function () {
  "use strict";
  /* Повторное подключение (и <script>, и import "./effects.mjs") не создаёт второй экземпляр. */
  if (window.fx && window.fx.version) return;
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  /* Режим движения: <html data-motion="full"> — анимации включены вручную (сильнее системной настройки),
     "reduce" — выключены вручную, без атрибута — как в системе (prefers-reduced-motion). */
  function reduced() {
    var m = root.getAttribute("data-motion");
    if (m === "full") return false;
    if (m === "reduce") return true;
    return !!(mq && mq.matches);
  }
  function systemReduced() { return !!(mq && mq.matches); }
  /** mode: "system" | "reduce" | "full" */
  function setMotion(mode) {
    if (mode === "reduce" || mode === "full") root.setAttribute("data-motion", mode);
    else root.removeAttribute("data-motion");
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* Строки интерфейса библиотеки. Для другого языка: fx.setStrings({ done: "Done", copied: "Copied", ... }). */
  var strings = {
    locale: document.documentElement.lang || "ru-RU",
    done: "Готово", copied: "Скопировано", copiedLong: "Скопировано в буфер обмена",
    copyFailed: "Выделите и скопируйте", close: "Закрыть", newNotifications: "Новых уведомлений",
    undo: "Отменить", undone: "Восстановлено", deleted: "Удалено", sheetClose: "Закрыть панель",
    streamDone: "Ответ готов", streamStopped: "Ответ остановлен"
  };
  function setStrings(s) { for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) strings[k] = s[k]; }

  /* ---------- Общие правила API ----------
     1. Первый аргумент — цель (элемент, слой или контейнер), второй — объект опций.
        Короткие позиционные формы из версии 1 (fx.zoom(el, 1.1, 300), fx.hitstop(70, [el])…) продолжают работать.
     2. Эффект возвращает Promise, который выполняется, когда эффект закончился (сразу — при «уменьшить движение»).
        Контроллеры возвращают объект: trauma → { add, setIntensity }, tabs → destroy(), toast → элемент с close().
     3. Координаты: у эффектов со слоем (wave, lines, beam, damageNumber) — внутри слоя;
        у burst, confetti, flyTo — окна (clientX/clientY); fx.center(el) даёт центр элемента в координатах окна. */
  function noop() {}
  function resolved() { return Promise.resolve(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function finished(anim) { return anim && anim.finished ? anim.finished.then(noop, noop) : resolved(); }
  function isEl(v) { return !!v && v.nodeType === 1; }
  function isObj(v) { return !!v && typeof v === "object" && !isEl(v) && !Array.isArray(v) && typeof v.length !== "number"; }
  function toEls(v) { return !v ? [] : isEl(v) ? [v] : Array.prototype.slice.call(v); }
  function extend(o, add) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in add) r[k] = add[k]; return r; }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* Гладкий псевдошум из суммы синусов: для тряски лучше, чем random() на каждом кадре. */
  function noise(seed) {
    var p1 = seed * 12.9898, p2 = seed * 78.233, p3 = seed * 37.719;
    return function (t) {
      return (Math.sin(t * 2.1 + p1) * 0.5 + Math.sin(t * 3.7 + p2) * 0.3 + Math.sin(t * 6.3 + p3) * 0.2);
    };
  }

  /* ---------- Формы ---------- */

  /** Тряска поля/контейнера при отклонённом вводе. Всегда вместе с текстом ошибки. */
  function shake(el, opts) {
    opts = opts || {};
    if (!el || reduced() || !el.animate) return resolved();
    var a = opts.amp || 8;
    return finished(el.animate([
      { transform: "translateX(0)" },
      { transform: "translateX(" + -a + "px)" },
      { transform: "translateX(" + a * 0.75 + "px)" },
      { transform: "translateX(" + -a * 0.5 + "px)" },
      { transform: "translateX(" + a * 0.25 + "px)" },
      { transform: "translateX(0)" }
    ], { duration: opts.duration || 360, easing: "ease-out" }));
  }

  /**
   * Ошибка поля: красная рамка + текст + aria + тряска.
   * field — <input>, message — текст, errorEl — элемент для текста (связывается через aria-describedby).
   */
  function fieldError(field, message, errorEl) {
    field.classList.add("fx-field-error");
    field.setAttribute("aria-invalid", "true");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      if (!errorEl.id) errorEl.id = "fx-err-" + Math.random().toString(36).slice(2, 8);
      setIds(field, "aria-describedby", ids(field, "aria-describedby").concat(errorEl.id));
    }
    shake(field.closest("[data-fx-shake]") || field);
  }
  function clearFieldError(field, errorEl) {
    field.classList.remove("fx-field-error");
    field.removeAttribute("aria-invalid");
    if (errorEl) {
      errorEl.textContent = ""; errorEl.hidden = true;
      if (errorEl.id) setIds(field, "aria-describedby", ids(field, "aria-describedby").filter(function (id) { return id !== errorEl.id; }));
    }
  }
  /* aria-describedby может уже указывать на подсказку к полю — ошибку добавляем рядом, а не вместо. */
  function ids(el, attr) { return (el.getAttribute(attr) || "").split(/\s+/).filter(Boolean); }
  function setIds(el, attr, list) {
    var uniq = list.filter(function (id, i) { return list.indexOf(id) === i; });
    if (uniq.length) el.setAttribute(attr, uniq.join(" ")); else el.removeAttribute(attr);
  }

  /** Галочка успеха: SVG с pathLength="1" у circle и path. */
  function check(svg) {
    svg.classList.remove("is-on");
    void svg.getBoundingClientRect();
    svg.classList.add("is-on");
  }

  /* ---------- Кнопки ---------- */

  /**
   * Кнопка в загрузке: ширина сохраняется, повторный клик заблокирован.
   * Не ставим disabled: у disabled-кнопки браузер отнимает фокус, и клавиатурный пользователь теряет место.
   * Вместо этого aria-disabled + перехват кликов; opts.label — что объявить скринридеру («Отправляем платёж»).
   */
  function loading(btn, on, opts) {
    opts = opts || {};
    if (on) {
      if (btn._fxBlock) return;
      btn.style.minWidth = btn.getBoundingClientRect().width + "px";
      btn.classList.add("fx-btn-loading");
      btn.setAttribute("aria-busy", "true");
      btn.setAttribute("aria-disabled", "true");
      btn._fxBlock = function (e) { e.preventDefault(); e.stopImmediatePropagation(); };
      btn.addEventListener("click", btn._fxBlock, true);
      if (opts.label) announce(opts.label);
    } else {
      btn.classList.remove("fx-btn-loading");
      btn.removeAttribute("aria-busy");
      btn.removeAttribute("aria-disabled");
      if (btn._fxBlock) { btn.removeEventListener("click", btn._fxBlock, true); btn._fxBlock = null; }
      btn.style.minWidth = "";
    }
  }


  /**
   * Кнопка → успех: заливка цветом успеха, текст сменяется рисующейся галочкой, ширина не меняется.
   * Отдельной надписи рядом не нужно; текст для скринридера — opts.label. opts.reset — вернуть исходный вид через N мс.
   */
  var SVG = "http://www.w3.org/2000/svg";
  function success(btn, opts) {
    opts = opts || {};
    if (btn.classList.contains("fx-btn-success")) return;
    var label = opts.label || strings.done;
    btn.style.minWidth = btn.getBoundingClientRect().width + "px";
    /* Исходные узлы переносим во фрагмент, а не копируем innerHTML: так сохраняются обработчики и состояние. */
    var saved = document.createDocumentFragment();
    while (btn.firstChild) saved.appendChild(btn.firstChild);
    btn._fxSaved = saved;
    btn.classList.add("fx-btn-success");
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "fx-btn-check"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(SVG, "path");
    path.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5"); path.setAttribute("pathLength", "1");
    svg.appendChild(path);
    var sr = document.createElement("span");
    sr.className = "fx-sr"; sr.textContent = label;   /* textContent: подпись не может внедрить разметку */
    btn.appendChild(svg); btn.appendChild(sr);
    announce(label);
    if (opts.reset) btn._fxReset = setTimeout(function () { resetSuccess(btn); }, opts.reset);
  }
  function resetSuccess(btn) {
    if (!btn.classList.contains("fx-btn-success")) return;
    clearTimeout(btn._fxReset);
    btn.classList.remove("fx-btn-success");
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    if (btn._fxSaved) btn.appendChild(btn._fxSaved);
    btn._fxSaved = null;
    btn.style.minWidth = "";
  }

  /** Копирование: смена подписи на «Скопировано» на 1.6 с + объявление. */
  function copy(btn, text, labelEl) {
    var label = labelEl || btn;
    /* Исходный текст запоминаем один раз: повторный клик за 1.6 с не должен сохранить «Скопировано» как исходное. */
    if (label._fxOriginal == null) label._fxOriginal = label.textContent;
    var restore = function (ms) {
      clearTimeout(label._fxTimer);
      label._fxTimer = setTimeout(function () { label.textContent = label._fxOriginal; label._fxOriginal = null; }, ms);
    };
    var fail = function () { label.textContent = strings.copyFailed; restore(3000); };
    var done = function () {
      label.textContent = strings.copied;
      announce(strings.copiedLong);
      pop(btn);
      restore(1600);
    };
    try {
      navigator.clipboard.writeText(text).then(done, fail);
    } catch (e) { fail(); }
  }

  /** Короткий «поп» масштаба (лайк, чекбокс, значок). */
  function pop(el) {
    if (reduced()) return resolved();
    el.classList.remove("fx-pop");
    void el.offsetWidth;
    el.classList.add("fx-pop");
    return wait(350);
  }

  /** Удар по счётчику: масштаб scale → 1 за ms (комбо, награда). fx.punch(el, { scale: 1.3, ms: 140 }) · fx.punch(el, s, ms). */
  function punch(el, o, ms) {
    o = isObj(o) ? o : { scale: o, ms: ms };
    if (reduced() || !el.animate) return resolved();
    return finished(el.animate([{ transform: "scale(" + (o.scale || 1.3) + ")" }, { transform: "scale(1)" }],
      { duration: o.ms || 140, easing: "cubic-bezier(.34,1.56,.64,1)" }));
  }

  /* ---------- Оверлеи ---------- */

  /* Live-регион создаётся при загрузке страницы: скринридеры часто пропускают
     первое сообщение в регионе, который появился в DOM одновременно с текстом. */
  var liveRegion;
  function ensureLive() {
    if (liveRegion || !document.body) return;
    liveRegion = document.createElement("div");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    document.body.appendChild(liveRegion);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureLive);
  else ensureLive();
  function announce(text) {
    ensureLive();
    liveRegion.textContent = "";
    setTimeout(function () { liveRegion.textContent = text; }, 100);
  }

  var toastHost;
  /** Тост для пассивных сообщений. Ошибки и действия в тосты не кладите. */
  function toast(message, opts) {
    opts = opts || {};
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "fx-toasts";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var t = document.createElement("div");
    t.className = "fx-toast " + (opts.className || "");
    var text = document.createElement("span");
    text.className = "fx-toast-text";
    text.textContent = message;
    var x = document.createElement("button");
    x.type = "button";
    x.className = "fx-toast-close";
    x.setAttribute("aria-label", strings.close);
    x.textContent = "\u00d7";
    t.appendChild(text);
    if (opts.action) {
      var act = document.createElement("button");
      act.type = "button";
      act.className = "fx-toast-action";
      act.textContent = opts.action.label;
      act.addEventListener("click", function () { if (opts.action.onClick) opts.action.onClick(); close(); });
      t.appendChild(act);
    }
    t.appendChild(x);
    t.setAttribute("data-state", "enter");
    toastHost.appendChild(t);
    while (toastHost.children.length > 3) toastHost.removeChild(toastHost.firstChild);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.removeAttribute("data-state"); }); });
    /* ≥ 5 с по умолчанию (с действием — 8 с); пауза, пока на тосте курсор или фокус (WCAG 2.2.1); всегда можно закрыть вручную. */
    var timer, remaining = opts.duration || (opts.action ? 8000 : 5000), started = Date.now(), paused = 0, closed = false;
    function close() {
      if (closed) return;
      closed = true; clearTimeout(timer);
      if (opts.onClose) opts.onClose();
      t.setAttribute("data-state", "exit");
      setTimeout(function () { t.remove(); }, reduced() ? 0 : 300);
    }
    var pause = function () { if (paused++ === 0) { clearTimeout(timer); remaining -= Date.now() - started; } };
    var resume = function () {
      if (--paused > 0) return;
      paused = 0; started = Date.now(); timer = setTimeout(close, Math.max(remaining, 1000));
    };
    x.addEventListener("click", close);
    t.addEventListener("mouseenter", pause);
    t.addEventListener("mouseleave", resume);
    t.addEventListener("focusin", pause);
    t.addEventListener("focusout", resume);
    started = Date.now(); timer = setTimeout(close, remaining);
    t.close = close;
    return t;
  }

  /* ---------- Навигация ---------- */

  /**
   * Вкладки по паттерну WAI-ARIA: контейнер .fx-tabs[role=tablist] с кнопками [role=tab] и .fx-tabs-ind.
   * Стрелки влево/вправо, Home/End, roving tabindex; панели из aria-controls показываются и прячутся сами,
   * иначе — container.onTabChange(tab). Возвращает функцию destroy() для SPA.
   */
  function tabs(container) {
    var ind = container.querySelector(".fx-tabs-ind");
    var tabsEls = Array.prototype.slice.call(container.querySelectorAll("[role=tab]"));
    function current() {
      return tabsEls.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0];
    }
    function move(tab) {
      if (!ind) return;
      var c = container.getBoundingClientRect(), r = tab.getBoundingClientRect();
      ind.style.setProperty("--x", (r.left - c.left + container.scrollLeft) + "px");
      ind.style.setProperty("--w", r.width);
    }
    function select(tab, focus) {
      tabsEls.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = t.getAttribute("aria-controls") && document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      move(tab);
      if (container.onTabChange) container.onTabChange(tab);
    }
    function onClick(e) {
      var tab = e.target.closest("[role=tab]");
      if (tab && tabsEls.indexOf(tab) > -1) select(tab, false);
    }
    function onKey(e) {
      var i = tabsEls.indexOf(document.activeElement);
      if (i < 0) return;
      var n = tabsEls.length, next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key];
      if (next == null) return;
      e.preventDefault();
      select(tabsEls[(next + n) % n], true);
    }
    container.addEventListener("click", onClick);
    container.addEventListener("keydown", onKey);
    var sel = current() || tabsEls[0];
    if (sel) {
      tabsEls.forEach(function (t) { t.tabIndex = t === sel ? 0 : -1; });
      move(sel);
    }
    var relayout = function () { var s = current(); if (s) move(s); };
    var ro = window.ResizeObserver ? new ResizeObserver(relayout) : null;
    if (ro) ro.observe(container); else window.addEventListener("resize", relayout);
    return function destroy() {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKey);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", relayout);
    };
  }

  /* ---------- Числа ---------- */

  /** Плавный рост числа (KPI, монеты). Длительность растёт логарифмически от разницы. */
  function countUp(el, to, opts) {
    opts = opts || {};
    var from = opts.from != null ? opts.from : parseFloat(el.dataset.value || "0") || 0;
    var fmt = opts.format || function (v) { return Math.round(v).toLocaleString(strings.locale); };
    el.dataset.value = to;
    /* Новый вызов отменяет предыдущий, иначе два цикла rAF спорят за текст. */
    if (el._fxRaf) cancelAnimationFrame(el._fxRaf);
    if (el._fxDone) { el._fxDone(); el._fxDone = null; }
    if (reduced()) { el.textContent = fmt(to); return resolved(); }
    /* Промежуточные числа скрыты от скринридера (aria-busy), итог читается, когда счёт закончен. */
    el.setAttribute("aria-busy", "true");
    var diff = Math.abs(to - from) || 1;
    var dur = opts.duration || clamp(350 + Math.log10(diff + 1) * 220, 350, 1200);
    var t0 = performance.now();
    return new Promise(function (res) {
      el._fxDone = res;
      (function step(now) {
        var p = clamp((now - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) { el._fxRaf = requestAnimationFrame(step); return; }
        el._fxRaf = 0; el._fxDone = null;
        el.removeAttribute("aria-busy");
        if (opts.punch !== false) punch(el, { scale: 1.15, ms: 160 });
        res();
      })(t0);
    });
  }

  /** Список с каскадом: ставит --i детям и перезапускает анимацию. */
  function stagger(list) {
    Array.prototype.forEach.call(list.children, function (c, i) { c.style.setProperty("--i", i); });
    list.classList.remove("fx-stagger");
    void list.offsetWidth;
    list.classList.add("fx-stagger");
  }

  /** Однократный класс-эффект (пульс бейджа, блик, пинг). */
  function once(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    return wait(ms || 2000).then(function () { el.classList.remove(cls); });
  }

  /* ---------- Частицы (один canvas, пул) ---------- */

  var canvas, ctx, parts = [], running = false, lastT = 0, timeScale = 1;
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }
  function resize() {
    var d = window.devicePixelRatio || 1;
    canvas.width = innerWidth * d; canvas.height = innerHeight * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function loop(now) {
    var dt = lastT ? Math.min(50, now - lastT) : 16.7; lastT = now;
    var sdt = dt * timeScale, k = sdt / 16.7, alive = 0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p.on) continue;
      p.age += sdt;
      var a = p.age / p.life;
      if (a >= 1) { p.on = false; continue; }
      alive++;
      var drag = Math.pow(p.drag, k);
      p.vx *= drag; p.vy = p.vy * drag + p.g * k;
      p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
      var f = 1 - a;
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else if (p.shape === "spark") ctx.fillRect(-p.size, -1, p.size * 2, 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size * (0.4 + 0.6 * f) / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(loop); else { running = false; lastT = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function spawn(o) {
    var p = null;
    for (var i = 0; i < parts.length; i++) if (!parts[i].on) { p = parts[i]; break; }
    if (!p) { if (parts.length > 600) return; p = {}; parts.push(p); }
    for (var key in o) p[key] = o[key];
    p.on = true; p.age = 0;
  }

  /**
   * Вспышка частиц. Координаты окна (clientX/clientY).
   *   fx.burst(el, opts)          — из центра элемента
   *   fx.burst({ x, y, ...opts })
   *   fx.burst(x, y, opts)        — краткая форма
   * opts: count 12, colors [], speed 4, life 500, size 6, gravity 0, drag .92, spread 360 (°), angle -90, shape dot|rect|spark
   */
  function burst(a, b, c) {
    var o, x, y;
    if (isEl(a)) { o = b || {}; var p = center(a); x = p.x; y = p.y; }
    else if (isObj(a)) { o = a; x = o.x; y = o.y; }
    else { o = c || {}; x = a; y = b; }
    if (reduced()) return resolved();
    ensureCanvas();
    var n = o.count || 12, colors = o.colors || ["#fff"], life = o.life || 500;
    var spread = (o.spread == null ? 360 : o.spread) * Math.PI / 180;
    var base = (o.angle == null ? -90 : o.angle) * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var ang = base + (Math.random() - 0.5) * spread;
      var v = (o.speed || 4) * (0.6 + Math.random() * 0.6);
      spawn({
        x: x, y: y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: o.gravity || 0, drag: o.drag || 0.92,
        life: life * (0.7 + Math.random() * 0.5), size: (o.size || 6) * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length], shape: o.shape || "dot", rot: (o.shape === "spark") ? ang : Math.random() * 6, vr: (o.shape === "spark") ? 0 : (Math.random() - 0.5) * 0.3
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
    return wait(life * 1.2 / timeScale);
  }

  /**
   * Конфетти: только для редких праздничных событий.
   *   fx.confetti()  ·  fx.confetti(el)  ·  fx.confetti({ x, y, colors })  ·  fx.confetti(x, y, colors)
   */
  function confetti(a, b, c) {
    var o = isObj(a) ? a : isEl(a) ? extend(b || {}, center(a)) : { x: a, y: b, colors: c };
    return burst({
      x: o.x == null ? innerWidth / 2 : o.x, y: o.y == null ? innerHeight * 0.35 : o.y,
      count: o.count || 90, colors: o.colors || ["#f0a24b", "#5b9be6", "#5fbf72", "#e66f8c", "#f2d16b"],
      speed: 9, life: 1600, size: 9, gravity: 0.18, drag: 0.97, spread: 120, angle: -90, shape: "rect"
    });
  }

  /* ---------- Игровые эффекты ---------- */

  /**
   * Тряска по модели «травмы» (Eiserloh): shake = trauma², плавный шум, затухание decay/с.
   * Возвращает контроллер { add(amount), setIntensity(v) }. Трясите сцену, а не HUD.
   */
  function trauma(el, opts) {
    opts = opts || {};
    var maxOffset = opts.maxOffset || 14, maxAngle = opts.maxAngle || 3, decay = opts.decay || 1.4;
    var t = 0, last = 0, time = 0, active = false;
    var nx = noise(1.3), ny = noise(7.1), nr = noise(4.7);
    var scale = opts.intensity == null ? 1 : opts.intensity;
    function frame(now) {
      var dt = last ? (now - last) / 1000 : 0.016;
      last = now; time += dt * (opts.speed || 22);
      t = Math.max(0, t - decay * dt);
      var s = t * t * scale;
      el.style.transform = s > 0.0005
        ? "translate(" + (maxOffset * s * nx(time)).toFixed(2) + "px," + (maxOffset * s * ny(time)).toFixed(2) + "px) rotate(" + (maxAngle * s * nr(time)).toFixed(2) + "deg)"
        : "";
      if (t > 0) requestAnimationFrame(frame); else { active = false; last = 0; el.style.transform = ""; }
    }
    return {
      add: function (amount) {
        if (reduced() || scale <= 0) return;
        t = clamp(t + amount, 0, 1);
        if (!active) { active = true; requestAnimationFrame(frame); }
      },
      setIntensity: function (v) { scale = v; }
    };
  }

  /** Белая вспышка попадания на объекте (1 раз, ~90 мс). При уменьшенном движении — контур. */
  function hitFlash(el) {
    if (!el.animate) return resolved();
    if (reduced()) return finished(el.animate([{ outline: "3px solid #fff" }, { outline: "3px solid transparent" }], { duration: 200 }));
    return finished(el.animate([{ filter: "brightness(2.6) saturate(0)" }, { filter: "none" }], { duration: 90, easing: "steps(1, end)" }));
  }

  /**
   * Хитстоп: замораживает CSS/WAAPI-анимации элементов (≈ 1 кадр = 16.7 мс).
   *   fx.hitstop(els, { ms: 80 })  ·  fx.hitstop(ms, els) — краткая форма
   */
  function hitstop(a, b) {
    var els, ms;
    if (typeof a === "number") { ms = a; els = b; } else { els = a; ms = isObj(b) ? b.ms : b; }
    ms = ms || 80;
    var anims = [];
    toEls(els).forEach(function (el) { if (el.getAnimations) anims = anims.concat(el.getAnimations({ subtree: true })); });
    anims.forEach(function (x) { try { x.pause(); } catch (e) {} });
    return wait(ms).then(function () { anims.forEach(function (x) { try { x.play(); } catch (e) {} }); });
  }

  /**
   * Всплывающая цифра урона/лечения внутри position:relative-контейнера.
   *   fx.damageNumber(container, { x, y, value, crit, heal, kind, text })
   *   fx.damageNumber(container, x, y, value, opts) — краткая форма
   */
  function damageNumber(container, a, y, value, opts) {
    var o = isObj(a) ? a : extend(opts || {}, { x: a, y: y, value: value });
    var d = document.createElement("span");
    d.className = "fx-dmg" + (o.crit ? " is-crit" : "") + (o.heal ? " is-heal" : "") + (o.kind ? " is-" + o.kind : "");
    d.textContent = o.text != null ? o.text : (o.heal ? "+" : "") + o.value + (o.crit ? "!" : "");
    d.style.left = o.x + "px"; d.style.top = o.y + "px";
    d.style.setProperty("--dx", ((Math.random() - 0.5) * 40).toFixed(0) + "px");
    d.setAttribute("aria-hidden", "true");
    container.appendChild(d);
    var ms = reduced() ? 700 : 900;
    return wait(ms).then(function () { d.remove(); });
  }

  /** Полоса здоровья с «призраком»: значение падает сразу, призрак догоняет с задержкой. */
  function health(bar, value) {
    var v = clamp(value, 0, 1);
    var fill = bar.querySelector(".fx-hp-fill"), ghost = bar.querySelector(".fx-hp-ghost");
    var prev = parseFloat(bar.dataset.hp || "1");
    bar.dataset.hp = v;
    bar.setAttribute("aria-valuenow", Math.round(v * 100));
    if (v < prev) {           // урон: основная сразу, призрак позже (transition-delay в CSS)
      fill.style.setProperty("--hp", v);
      ghost.style.setProperty("--ghost", v);
    } else {                  // лечение: призрак сразу, основная догоняет
      ghost.style.setProperty("--ghost", v);
      setTimeout(function () { fill.style.setProperty("--hp", v); }, reduced() ? 0 : 250);
    }
    return wait(reduced() ? 0 : 850);
  }

  /** Сжатие и растяжение для прыжка (Celeste: 0.6×1.4 → 1.4×0.6 → 1). fx.squashJump(el, { height: 48 }). */
  function squashJump(el, o) {
    o = isObj(o) ? o : { height: o };
    if (reduced() || !el.animate) return resolved();
    el.style.transformOrigin = "50% 100%";
    var h = o.height || 48;
    return finished(el.animate([
      { transform: "translateY(0) scale(1.25,.8)" },
      { transform: "translateY(" + -h + "px) scale(.75,1.3)", offset: 0.3 },
      { transform: "translateY(" + -h * 1.1 + "px) scale(1,1)", offset: 0.5 },
      { transform: "translateY(0) scale(1.35,.7)", offset: 0.82 },
      { transform: "translateY(0) scale(1,1)" }
    ], { duration: o.ms || 620, easing: "ease-out" }));
  }


  /* ---------- Слой движения по умолчанию ---------- */

  /** Нумерует элементы для каскада: fx.sequence(".fx-enter") ставит --i по порядку в DOM. */
  function sequence(selector, rootEl) {
    var els = (rootEl || document).querySelectorAll(selector || ".fx-enter, .fx-enter-fade");
    Array.prototype.forEach.call(els, function (el, i) { if (!el.style.getPropertyValue("--i")) el.style.setProperty("--i", i); });
    return els;
  }

  /**
   * FLIP-перестановка (сортировка, фильтр): элементы плавно едут на новые места.
   * container — родитель, mutate — функция, меняющая DOM, opts.key(el) — стабильный ключ (по умолчанию data-key).
   */
  function flip(container, mutate, opts) {
    opts = opts || {};
    var key = opts.key || function (el) { return el.getAttribute("data-key"); };
    var before = {};
    Array.prototype.forEach.call(container.children, function (el) {
      var k = key(el); if (k != null) before[k] = el.getBoundingClientRect();
    });
    mutate();
    if (reduced()) return resolved();
    var entering = 0, anims = [];
    Array.prototype.forEach.call(container.children, function (el) {
      if (!el.animate) return;
      var k = key(el), f = before[k], l = el.getBoundingClientRect();
      if (!f) {
        anims.push(el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 260, delay: Math.min(entering++, 8) * 30, easing: "cubic-bezier(.2,0,0,1)", fill: "backwards" }));
        return;
      }
      var dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        anims.push(el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }],
          { duration: opts.duration || 380, easing: "cubic-bezier(.2,0,0,1)" }));
      }
    });
    return Promise.all(anims.map(finished)).then(noop);
  }

  /**
   * Плавная смена текста/содержимого (вкладки, значения): уход 120 мс, вход 200 мс.
   * fx.swap(el, content, { html: true }) — только для своей, доверенной разметки; пользовательский текст — без html.
   */
  function swap(el, content, o) {
    var html = o === true || (isObj(o) && o.html);
    var set = function () { if (html) el.innerHTML = content; else el.textContent = content; };
    if (reduced() || !el.animate) { set(); return resolved(); }
    return finished(el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px)" }],
      { duration: 120, easing: "cubic-bezier(.3,0,1,1)" })).then(function () {
      set();
      return finished(el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
        { duration: 200, easing: "cubic-bezier(.2,0,0,1)" }));
    });
  }

  /**
   * Счёт чисел при первом показе: элементы с data-count="1234.5" (и data-decimals, data-prefix, data-suffix).
   * Текст в разметке — финальное значение, поэтому без JS всё корректно.
   */
  function countAll(selector, rootEl) {
    var els = (rootEl || document).querySelectorAll(selector || "[data-count]");
    var jobs = [];
    Array.prototype.forEach.call(els, function (el, i) {
      var to = parseFloat(el.getAttribute("data-count"));
      if (isNaN(to)) return;
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "";
      var nf = new Intl.NumberFormat(strings.locale, { minimumFractionDigits: dec, maximumFractionDigits: dec });
      var fmt = function (v) { return pre + nf.format(v) + suf; };
      jobs.push(wait(150 + i * 60).then(function () {
        return countUp(el, to, { from: 0, format: fmt, punch: false, duration: el.getAttribute("data-duration") ? +el.getAttribute("data-duration") : 900 });
      }));
    });
    return Promise.all(jobs).then(noop);
  }

  /**
   * Смена темы с круговым раскрытием от точки клика (View Transitions).
   * apply — функция, меняющая data-theme; event — событие клика (для центра круга).
   */
  function themeSwitch(apply, event) {
    if (event && event.clientX != null) {
      root.style.setProperty("--fx-x", event.clientX + "px");
      root.style.setProperty("--fx-y", event.clientY + "px");
    }
    if (!document.startViewTransition || reduced()) { apply(); return resolved(); }
    var vt = document.startViewTransition(apply);
    return vt.finished.then(noop, noop);
  }


  /**
   * Новое уведомление: колокольчик качается (800 мс), бейдж «выпрыгивает» и даёт кольцо-пульс.
   *   fx.ring(bell, { badge, count })  ·  fx.ring(bell, badge, count) — краткая форма
   */
  function ring(bell, a, c) {
    var o = isObj(a) ? a : { badge: a, count: c };
    var badge = o.badge, count = o.count;
    if (badge && count != null) { badge.textContent = count > 99 ? "99+" : count; badge.hidden = !count; }
    once(bell, "is-ringing", 900);
    if (badge) once(badge, "is-pulsing", 1900);
    if (count != null) announce(strings.newNotifications + ": " + count);
    return wait(900);
  }


  /* ---------- Игровые слои эффектов ---------- */

  function place(layer, el, x, y, w, h) {
    el.style.left = (x - w / 2) + "px"; el.style.top = (y - h / 2) + "px";
    el.style.width = w + "px"; el.style.height = h + "px";
    layer.appendChild(el); return el;
  }
  function done(anim, el) {
    if (!anim) return wait(400).then(function () { el.remove(); });
    return finished(anim).then(function () { el.remove(); });
  }

  /**
   * Цветная вспышка объекта (лечение — зелёная, яд — ядовитая, мороз — голубая): оттенок + свечение.
   *   fx.tint(el, { color, ms: 520 })  ·  fx.tint(el, color, ms) — краткая форма
   */
  function tint(el, a, ms) {
    var o = isObj(a) ? a : { color: a, ms: ms };
    var dur = o.ms || 520, color = o.color || "#3dd68c";
    var t = document.createElement("span"); t.className = "fx-tint"; t.style.background = color; t.setAttribute("aria-hidden", "true");
    el.appendChild(t);
    if (reduced() || !t.animate) { t.style.opacity = .55; return wait(dur).then(function () { t.remove(); }); }
    el.animate([{ filter: "drop-shadow(0 0 0 transparent)" }, { filter: "drop-shadow(0 0 16px " + color + ") brightness(1.15)", offset: .3 }, { filter: "drop-shadow(0 0 0 transparent)" }],
      { duration: dur * 1.2, easing: "ease-out" });
    return done(t.animate([{ opacity: 0 }, { opacity: .9, offset: .25 }, { opacity: 0 }], { duration: dur, easing: "ease-out" }), t);
  }

  /** Аргументы слоевых эффектов: (layer, { x, y, ... }) или краткая форма (layer, x, y, opts). */
  function layerArgs(a, y, opts) { return isObj(a) ? a : extend(opts || {}, { x: a, y: y }); }

  /** Кольцо-волна (ударная волна, лечение у ног, щит). fx.wave(layer, { x, y, size, color, width, ms, squash }). */
  function wave(layer, a, y, opts) {
    var o = layerArgs(a, y, opts);
    if (reduced()) return resolved();
    var s = o.size || 140, el = document.createElement("span");
    el.className = "fx-wave"; el.style.borderColor = o.color || "#fff"; el.style.borderWidth = (o.width || 3) + "px";
    el.setAttribute("aria-hidden", "true");
    if (o.squash) el.style.transform = "scaleY(" + o.squash + ")";
    place(layer, el, o.x, o.y, s, s);
    return done(el.animate([{ scale: ".15", opacity: 1 }, { scale: "1", opacity: 0 }], { duration: o.ms || 450, easing: "cubic-bezier(.2,0,0,1)" }), el);
  }

  /** Радиальные линии удара (крит, тяжёлый удар). fx.lines(layer, { x, y, count, inner, len, color, ms }). */
  function lines(layer, a, y, opts) {
    var o = layerArgs(a, y, opts);
    if (reduced()) return resolved();
    var n = o.count || 14, r1 = o.inner || 26, r2 = r1 + (o.len || 70), size = (r2 + 10) * 2;
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", (-size / 2) + " " + (-size / 2) + " " + size + " " + size);
    svg.setAttribute("class", "fx-lines");
    svg.setAttribute("aria-hidden", "true");
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + Math.random() * 0.25, l = document.createElementNS(SVG, "line");
      var rr = r2 - Math.random() * 20;
      l.setAttribute("x1", Math.cos(ang) * r1); l.setAttribute("y1", Math.sin(ang) * r1);
      l.setAttribute("x2", Math.cos(ang) * rr); l.setAttribute("y2", Math.sin(ang) * rr);
      l.setAttribute("stroke", o.color || "#fff"); l.setAttribute("stroke-width", i % 3 ? 2 : 3.5); l.setAttribute("stroke-linecap", "round");
      svg.appendChild(l);
    }
    place(layer, svg, o.x, o.y, size, size);
    return done(svg.animate([{ scale: ".55", opacity: 1 }, { scale: "1.25", opacity: 0 }], { duration: o.ms || 240, easing: "cubic-bezier(.2,0,0,1)" }), svg);
  }

  /**
   * Одиночная вспышка экрана (крит, получение урона). Встроенный ограничитель: не больше 3 вспышек за секунду
   * (WCAG 2.3.1) — лишние вызовы пропускаются.
   *   fx.flash(overlay, { color, alpha: .3, ms: 200 })  ·  fx.flash(overlay, color, alpha, ms) — краткая форма
   */
  var flashTimes = [];
  function flash(overlay, a, alpha, ms) {
    var o = isObj(a) ? a : { color: a, alpha: alpha, ms: ms };
    if (reduced() || !overlay.animate) return resolved();
    var now = Date.now();
    flashTimes = flashTimes.filter(function (t) { return now - t < 1000; });
    if (flashTimes.length >= 3) return resolved();
    flashTimes.push(now);
    if (o.color) overlay.style.background = o.color;
    return finished(overlay.animate([{ opacity: 0 }, { opacity: o.alpha == null ? .3 : o.alpha, offset: .2 }, { opacity: 0 }], { duration: o.ms || 200, easing: "ease-out" }));
  }

  /**
   * Короткий «наезд» камеры (зум-панч). Использует свойство scale, не мешает тряске через transform.
   *   fx.zoom(el, { scale: 1.06, ms: 280 })  ·  fx.zoom(el, s, ms) — краткая форма
   */
  function zoom(el, a, ms) {
    var o = isObj(a) ? a : { scale: a, ms: ms };
    if (reduced() || !el.animate) return resolved();
    return finished(el.animate([{ scale: "1" }, { scale: String(o.scale || 1.06), offset: .25 }, { scale: "1" }], { duration: o.ms || 280, easing: "cubic-bezier(.2,0,0,1)" }));
  }

  /**
   * Замедление времени: частицы и анимации элементов идут со скоростью rate на ms (реального времени).
   * Новый вызов продлевает замедление, а не обрывает его раньше времени.
   *   fx.slowmo(els, { rate: .3, ms: 400 })  ·  fx.slowmo(rate, ms, els) — краткая форма
   */
  var slowToken = 0, slowAnims = [];
  function slowmo(a, b, c) {
    var els, o;
    if (typeof a === "number") { o = { rate: a, ms: b }; els = c; } else { els = a; o = b || {}; }
    if (reduced()) return resolved();
    var rate = o.rate == null ? 0.3 : o.rate, ms = o.ms || 400, token = ++slowToken;
    timeScale = rate;
    toEls(els).forEach(function (el) { if (el.getAnimations) slowAnims = slowAnims.concat(el.getAnimations({ subtree: true })); });
    slowAnims.forEach(function (x) { try { x.playbackRate = rate; } catch (e) {} });
    return wait(ms).then(function () {
      if (token !== slowToken) return;      // сработал более поздний вызов — он и вернёт скорость
      timeScale = 1;
      slowAnims.forEach(function (x) { try { x.playbackRate = 1; } catch (e) {} });
      slowAnims = [];
    });
  }

  /**
   * Надпись-штамп по центру («КРИТ!», «УРОВЕНЬ 2», «ПОБЕДА»).
   *   fx.stamp(layer, { text, color, shadow, ms })  ·  fx.stamp(layer, text, opts) — краткая форма
   */
  function stamp(layer, a, opts) {
    var o = isObj(a) ? a : extend(opts || {}, { text: a });
    var el = document.createElement("div"); el.className = "fx-stamp"; el.textContent = o.text; el.setAttribute("aria-hidden", "true");
    if (o.color) el.style.color = o.color;
    if (o.shadow) el.style.textShadow = o.shadow;
    layer.appendChild(el);
    if (o.announce) announce(o.text);
    if (reduced() || !el.animate) return wait(900).then(function () { el.remove(); });
    return done(el.animate([
      { scale: "2.4", opacity: 0 }, { scale: ".92", opacity: 1, offset: .14 }, { scale: "1", opacity: 1, offset: .22 },
      { scale: "1", opacity: 1, offset: .75 }, { scale: "1.08", opacity: 0, translate: "-50% -80%" }
    ], { duration: o.ms || 1100, easing: "ease-out" }), el);
  }

  /**
   * Остаточное изображение (рывок, уклонение): полупрозрачная копия гаснет за ms.
   *   fx.afterimage(el, { layer, color, alpha: .45, ms: 320 })  ·  fx.afterimage(el, layer, opts) — краткая форма
   */
  function afterimage(el, a, opts) {
    var o = isEl(a) ? extend(opts || {}, { layer: a }) : (a || {});
    var layer = o.layer || el.parentNode;
    if (reduced() || !layer) return resolved();
    var lr = layer.getBoundingClientRect(), r = el.getBoundingClientRect();
    var g = el.cloneNode(true);
    /* Копия — чистая декорация: без id (их нельзя дублировать), недоступна скринридеру, фокусу и клику. */
    g.removeAttribute("id");
    Array.prototype.forEach.call(g.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
    g.setAttribute("aria-hidden", "true");
    g.setAttribute("inert", "");
    g.className = el.className + " fx-ghost";
    g.style.cssText = el.style.cssText;
    g.style.position = "absolute"; g.style.left = (r.left - lr.left) + "px"; g.style.top = (r.top - lr.top) + "px";
    g.style.width = r.width + "px"; g.style.height = r.height + "px"; g.style.bottom = "auto"; g.style.right = "auto";
    g.style.margin = "0"; g.style.transform = "none"; g.style.animation = "none"; g.style.opacity = ""; g.style.pointerEvents = "none";
    if (o.color) g.style.filter = "drop-shadow(0 0 0 " + o.color + ") opacity(.8)";
    layer.appendChild(g);
    return done(g.animate([{ opacity: o.alpha || .45 }, { opacity: 0 }], { duration: o.ms || 320, easing: "ease-out" }), g);
  }

  /** Световой столб (уровень, воскрешение). fx.beam(layer, { x, width, color, ms }) · fx.beam(layer, x, opts). */
  function beam(layer, a, opts) {
    var o = isObj(a) ? a : extend(opts || {}, { x: a });
    if (reduced()) return resolved();
    var w = o.width || 56, el = document.createElement("span"); el.className = "fx-beam";
    el.setAttribute("aria-hidden", "true");
    el.style.left = (o.x - w / 2) + "px"; el.style.width = w + "px";
    el.style.background = "linear-gradient(to top, " + (o.color || "rgb(255 220 120 / .85)") + ", transparent 85%)";
    layer.appendChild(el);
    return done(el.animate([{ scale: "1 0", opacity: 1 }, { scale: "1 1", opacity: 1, offset: .25 }, { scale: ".6 1", opacity: 0 }], { duration: o.ms || 900, easing: "ease-out" }), el);
  }

  /** Дрожь объекта во время хитстопа (метод Сакураи). fx.jitter(el, { ms: 80, amp: 3 }) · fx.jitter(el, ms, amp). */
  function jitter(el, a, amp) {
    var o = isObj(a) ? a : { ms: a, amp: amp };
    if (reduced() || !el.animate) return resolved();
    var A = o.amp || 3, ms = o.ms || 80, steps = Math.max(2, Math.round(ms / 16.7)), kf = [];
    for (var i = 0; i <= steps; i++) kf.push({ translate: (i === steps ? 0 : (i % 2 ? -1 : 1) * A * (1 - i / steps)) + "px 0" });
    return finished(el.animate(kf, { duration: ms, easing: "linear" }));
  }

  /**
   * Монеты летят по дуге к счётчику; onEach(i) вызывается при прилёте каждой (прибавить значение, «пинг»).
   *   fx.flyTo(target, { from: el | { x, y }, count: 6, onEach })  ·  fx.flyTo(fromX, fromY, target, opts) — краткая форма
   * Координаты from — окна (clientX/clientY).
   */
  function flyTo(a, b, c, d) {
    var target, o;
    if (typeof a === "number") { target = c; o = extend(d || {}, { from: { x: a, y: b } }); } else { target = a; o = b || {}; }
    var from = isEl(o.from) ? center(o.from) : (o.from || center(target));
    var n = o.count || 6, tc = center(target), jobs = [];
    for (var i = 0; i < n; i++) (function (i) {
      if (reduced()) { if (o.onEach) o.onEach(i); return; }
      var cn = document.createElement("span"); cn.className = "fx-coin"; cn.setAttribute("aria-hidden", "true");
      cn.style.left = from.x + "px"; cn.style.top = from.y + "px";
      document.body.appendChild(cn);
      var dx = tc.x - from.x, dy = tc.y - from.y, spreadX = (Math.random() - .5) * 90, up = -60 - Math.random() * 50;
      var an = cn.animate([
        { transform: "translate(0,0) scale(.6)" },
        { transform: "translate(" + spreadX + "px," + up + "px) scale(1)", offset: .3 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(.7)" }
      ], { duration: 620 + i * 40, delay: i * 70, easing: "cubic-bezier(.5,0,.75,0)", fill: "backwards" });
      jobs.push(finished(an).then(function () { cn.remove(); if (o.onEach) o.onEach(i); }));
    })(i);
    return Promise.all(jobs).then(noop);
  }



  /* ---------- Жесты и ИИ ---------- */

  /**
   * Нижняя шторка на <dialog class="fx-sheet">: открытие снизу, закрытие свайпом вниз за ручку или шапку,
   * по клику на фон и по Esc. Внутри можно разместить <button class="fx-sheet-handle"> — ручку и кнопку закрытия.
   *   var s = fx.sheet(dialog, { onClose, threshold: .3 }); s.open(); s.close(); s.destroy();
   * Свайп — не единственный способ: ручка — кнопка, Esc и фон закрывают (WCAG 2.5.7).
   */
  function sheet(dialog, opts) {
    opts = opts || {};
    var threshold = opts.threshold || 0.3, closing = false;
    var handle = dialog.querySelector(".fx-sheet-handle");
    if (handle && !handle.getAttribute("aria-label")) handle.setAttribute("aria-label", strings.sheetClose);
    var drag = null;
    function open() {
      closing = false;
      dialog.style.transform = "";
      if (!dialog.open) dialog.showModal();
    }
    function close() {
      if (!dialog.open || closing) return resolved();
      closing = true;
      var finish = function () { dialog.close(); dialog.style.transform = ""; dialog.style.transition = ""; closing = false; if (opts.onClose) opts.onClose(); };
      if (reduced() || !dialog.animate) { finish(); return resolved(); }
      var from = dialog.style.transform || "translateY(0)";
      return finished(dialog.animate([{ transform: from }, { transform: "translateY(100%)" }], { duration: 220, easing: "cubic-bezier(.3,0,1,1)" })).then(finish);
    }
    function onCancel(e) { e.preventDefault(); close(); }
    function onClick(e) { if (e.target === dialog) close(); else if (handle && handle.contains(e.target) && !drag) close(); }
    function onDown(e) {
      var grip = e.target.closest(".fx-sheet-handle, .fx-sheet-grip");
      if (!grip || !dialog.contains(grip)) return;
      drag = { y: e.clientY, t: e.timeStamp, dy: 0, moved: false, id: e.pointerId };
      try { dialog.setPointerCapture(e.pointerId); } catch (err) {}
      dialog.style.transition = "none";
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dy = Math.max(0, e.clientY - drag.y);
      if (drag.dy > 4) drag.moved = true;
      dialog.style.transform = "translateY(" + drag.dy + "px)";
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag, h = dialog.getBoundingClientRect().height || 1, v = d.dy / Math.max(1, e.timeStamp - d.t);
      dialog.style.transition = "";
      if (d.moved && (d.dy > h * threshold || v > 0.6)) close();
      else dialog.style.transform = "";
      if (d.moved) { e.preventDefault(); setTimeout(function () { drag = null; }, 0); } else drag = null;
    }
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointermove", onMove);
    dialog.addEventListener("pointerup", onUp);
    dialog.addEventListener("pointercancel", onUp);
    return {
      open: open, close: close,
      destroy: function () {
        dialog.removeEventListener("cancel", onCancel);
        dialog.removeEventListener("click", onClick);
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointermove", onMove);
        dialog.removeEventListener("pointerup", onUp);
        dialog.removeEventListener("pointercancel", onUp);
      }
    };
  }

  /**
   * Свайп влево для удаления с окном «Отменить» (тост с действием). Удаление совершается только после
   * окна Undo — тогда вызывается onCommit; «Отменить» возвращает строку и вызывает onUndo.
   *   fx.swipeToDelete(row, { onCommit, onUndo, label: "Платёж удалён", undoMs: 6000, threshold: .4, button })
   * opts.button — обычная кнопка «Удалить» в строке: свайп не может быть единственным способом (WCAG 2.5.7).
   * Возвращает destroy().
   */
  function swipeToDelete(row, opts) {
    opts = opts || {};
    var threshold = opts.threshold || 0.4, drag = null;
    row.classList.add("fx-swipe");
    function remove() {
      var h = row.getBoundingClientRect().height;
      var slide = reduced() || !row.animate ? resolved()
        : finished(row.animate([{ transform: row.style.transform || "translateX(0)", opacity: 1 }, { transform: "translateX(-100%)", opacity: 0 }], { duration: 200, easing: "cubic-bezier(.3,0,1,1)" }));
      return slide.then(function () {
        row.style.transform = "";
        if (!reduced() && row.animate) {
          row.style.overflow = "hidden";
          return finished(row.animate([{ height: h + "px" }, { height: "0px", paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px" }], { duration: 180, easing: "ease-in" }));
        }
      }).then(function () {
        row.hidden = true; row.style.overflow = "";
        var committed = false;
        var t = toast(opts.label || strings.deleted, {
          duration: opts.undoMs || 6000,
          action: { label: strings.undo, onClick: function () { committed = true; restore(); } },
          onClose: function () { if (!committed) { committed = true; if (opts.onCommit) opts.onCommit(); } }
        });
        return t;
      });
    }
    function restore() {
      row.hidden = false;
      if (opts.onUndo) opts.onUndo();
      if (!reduced() && row.animate) row.animate([{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,0,0,1)" });
      announce(strings.undone);
    }
    function onDown(e) {
      if (e.button !== 0 || e.target.closest("button, a, input, select, textarea, label")) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId, axis: null };
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (drag.axis === "x") { try { row.setPointerCapture(e.pointerId); } catch (err) {} } else { drag = null; return; }
      }
      if (drag.axis !== "x") return;
      drag.dx = Math.min(0, dx);
      row.style.transform = "translateX(" + drag.dx + "px)";
      row.classList.toggle("is-armed", -drag.dx > row.offsetWidth * threshold);
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var go = -drag.dx > row.offsetWidth * threshold;
      drag = null; row.classList.remove("is-armed");
      if (go) remove();
      else if (row.style.transform) {
        if (!reduced() && row.animate) row.animate([{ transform: row.style.transform }, { transform: "translateX(0)" }], { duration: 180, easing: "cubic-bezier(.2,0,0,1)" });
        row.style.transform = "";
      }
    }
    function onButton() { remove(); }
    row.addEventListener("pointerdown", onDown);
    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", onUp);
    row.addEventListener("pointercancel", onUp);
    if (opts.button) opts.button.addEventListener("click", onButton);
    return function destroy() {
      row.removeEventListener("pointerdown", onDown);
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", onUp);
      row.removeEventListener("pointercancel", onUp);
      if (opts.button) opts.button.removeEventListener("click", onButton);
      row.classList.remove("fx-swipe", "is-armed");
    };
  }

  /**
   * Потоковый вывод ответа ИИ: текст дописывается в el, в конце — статичная каретка.
   * source — строка (печатается со скоростью cps символов в секунду) или AsyncIterable<string> (настоящий поток).
   * Пока идёт поток, у el aria-busy="true" — скринридер не читает каждый кусок; в конце — «Ответ готов».
   * opts.signal (AbortSignal) останавливает поток, уже выведенный текст остаётся.
   *   await fx.stream(answerEl, response.body.pipeThrough(new TextDecoderStream()), { signal })
   */
  function stream(el, source, opts) {
    opts = opts || {};
    var caret = null, stopped = false;
    if (opts.caret !== false) {
      caret = document.createElement("span"); caret.className = "fx-caret"; caret.setAttribute("aria-hidden", "true");
      el.appendChild(caret);
    }
    el.setAttribute("aria-busy", "true");
    var write = function (chunk) {
      var node = document.createTextNode(chunk);
      if (caret && caret.parentNode === el) el.insertBefore(node, caret); else el.appendChild(node);
    };
    if (opts.signal) {
      if (opts.signal.aborted) stopped = true;
      opts.signal.addEventListener("abort", function () { stopped = true; });
    }
    var run;
    if (typeof source === "string") {
      if (reduced() || opts.cps === 0) { write(source); run = resolved(); }
      else {
        var cps = opts.cps || 60, i = 0, t0 = performance.now();
        run = new Promise(function (res) {
          (function tick(now) {
            if (stopped) return res();
            var n = Math.min(source.length, Math.floor((now - t0) / 1000 * cps));
            if (n > i) { write(source.slice(i, n)); i = n; }
            if (i < source.length) requestAnimationFrame(tick); else res();
          })(t0);
        });
      }
    } else {
      /* ReadableStream без async-итератора (старый Safari) читаем через reader. */
      var reader = !source[Symbol.asyncIterator] && source.getReader ? source.getReader() : null;
      var it = reader ? { next: function () { return reader.read(); }, return: function () { return reader.cancel(); } }
        : source[Symbol.asyncIterator] ? source[Symbol.asyncIterator]() : source;
      run = (function next() {
        if (stopped) return resolved();
        return Promise.resolve(it.next()).then(function (r) {
          if (r.done || stopped) { if (stopped && it.return) try { it.return(); } catch (e) {} return; }
          write(String(r.value));
          return next();
        });
      })();
    }
    return run.then(function () {
      if (caret) caret.remove();
      el.removeAttribute("aria-busy");
      announce(stopped ? strings.streamStopped : strings.streamDone);
    }, function (err) {
      if (caret) caret.remove();
      el.removeAttribute("aria-busy");
      throw err;
    });
  }

  /* ---------- Одометр и переход между экранами ---------- */

  /**
   * Одометр: цифры прокручиваются по разрядам к новому значению. Для балансов и счётчиков в дашбордах,
   * не для сумм, которые сверяют при оплате. Скринридер получает итог через aria-label.
   * opts.format(v) → строка (по умолчанию разряды по локали), opts.duration — время старшего разряда.
   */
  function odometer(el, to, opts) {
    opts = opts || {};
    var fmt = opts.format || function (v) { return Math.round(v).toLocaleString(strings.locale); };
    var text = fmt(to), prev = el._fxOdo || [];
    el.setAttribute("aria-label", text);
    el.setAttribute("role", "img");
    if (reduced() || !el.animate) {
      el.classList.remove("fx-odo"); el.textContent = text;
      el._fxOdo = text.replace(/\D/g, "").split("").map(Number);
      return resolved();
    }
    el.classList.add("fx-odo");
    el.textContent = "";
    var digits = text.replace(/\D/g, "").split("").map(Number), jobs = [], di = 0, dur = opts.duration || 700;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (!/\d/.test(ch)) { var sep = document.createElement("span"); sep.className = "fx-odo-sep"; sep.textContent = ch; el.appendChild(sep); continue; }
      var col = document.createElement("span"), strip = document.createElement("span");
      col.className = "fx-odo-col"; strip.className = "fx-odo-strip";
      for (var d = 0; d < 10; d++) { var n = document.createElement("span"); n.textContent = d; strip.appendChild(n); }
      col.appendChild(strip); el.appendChild(col);
      /* Разряды сравниваются справа: старое число может быть короче нового. */
      var fromIdx = prev.length - (digits.length - di);
      var from = fromIdx >= 0 ? prev[fromIdx] : 0, target = digits[di];
      strip.style.transform = "translateY(" + (-target * 10) + "%)";
      if (from !== target) {
        jobs.push(finished(strip.animate([{ transform: "translateY(" + (-from * 10) + "%)" }, { transform: "translateY(" + (-target * 10) + "%)" }],
          { duration: dur + (digits.length - di) * 40, easing: "cubic-bezier(.2,0,0,1)" })));
      }
      di++;
    }
    el._fxOdo = digits;
    return Promise.all(jobs).then(noop);
  }

  /**
   * Переход между состояниями экрана через View Transitions API (список → карточка).
   * apply() меняет DOM; общим элементам задай одинаковый view-transition-name.
   * Без поддержки браузера и при «уменьшить движение» DOM меняется сразу.
   */
  function viewTransition(apply) {
    if (reduced() || !document.startViewTransition) { apply(); return resolved(); }
    var done = false;
    var t = document.startViewTransition(function () { done = true; apply(); });
    /* Если страница не рисуется (фоновая вкладка), снимок может не начаться: тогда меняем DOM без перехода. */
    setTimeout(function () { if (!done) t.skipTransition(); }, 400);
    return t.finished.then(noop, noop);
  }

  window.fx = {
    version: "2.0.0",
    reduced: reduced, systemReduced: systemReduced, setMotion: setMotion, setStrings: setStrings, center: center,
    shake: shake, fieldError: fieldError, clearFieldError: clearFieldError, check: check,
    loading: loading, success: success, resetSuccess: resetSuccess, copy: copy, pop: pop, punch: punch, announce: announce, toast: toast, tabs: tabs,
    countUp: countUp, stagger: stagger, once: once, burst: burst, confetti: confetti,
    trauma: trauma, hitFlash: hitFlash, hitstop: hitstop, damageNumber: damageNumber, health: health,
    squashJump: squashJump, sequence: sequence, flip: flip, swap: swap, countAll: countAll, themeSwitch: themeSwitch, ring: ring,
    tint: tint, wave: wave, lines: lines, flash: flash, zoom: zoom, slowmo: slowmo, stamp: stamp,
    afterimage: afterimage, beam: beam, jitter: jitter, flyTo: flyTo,
    sheet: sheet, swipeToDelete: swipeToDelete, stream: stream,
    odometer: odometer, viewTransition: viewTransition
  };
})();
