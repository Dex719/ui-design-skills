/* ui-design · библиотека эффектов (JS, без зависимостей)
   Подключение: effects.css + этот файл. API: window.fx.*
   Каждая функция сама проверяет «уменьшить движение» и в этом режиме
   оставляет смысл (цвет, текст, aria-live), но убирает движение. */
(function () {
  "use strict";
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
    if (!el || reduced() || !el.animate) return null;
    var a = opts.amp || 8;
    return el.animate([
      { transform: "translateX(0)" },
      { transform: "translateX(" + -a + "px)" },
      { transform: "translateX(" + a * 0.75 + "px)" },
      { transform: "translateX(" + -a * 0.5 + "px)" },
      { transform: "translateX(" + a * 0.25 + "px)" },
      { transform: "translateX(0)" }
    ], { duration: opts.duration || 360, easing: "ease-out" });
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
      field.setAttribute("aria-describedby", errorEl.id);
    }
    shake(field.closest("[data-fx-shake]") || field);
  }
  function clearFieldError(field, errorEl) {
    field.classList.remove("fx-field-error");
    field.removeAttribute("aria-invalid");
    if (errorEl) { errorEl.textContent = ""; errorEl.hidden = true; }
  }

  /** Галочка успеха: SVG с pathLength="1" у circle и path. */
  function check(svg) {
    svg.classList.remove("is-on");
    void svg.getBoundingClientRect();
    svg.classList.add("is-on");
  }

  /* ---------- Кнопки ---------- */

  /** Кнопка в загрузке: ширина сохраняется, повторный клик заблокирован. */
  function loading(btn, on) {
    if (on) {
      btn.style.minWidth = btn.getBoundingClientRect().width + "px";
      btn.classList.add("fx-btn-loading");
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;
    } else {
      btn.classList.remove("fx-btn-loading");
      btn.removeAttribute("aria-busy");
      btn.disabled = false;
      btn.style.minWidth = "";
    }
  }


  /**
   * Кнопка → успех: заливка цветом успеха, текст сменяется рисующейся галочкой, ширина не меняется.
   * Отдельной надписи рядом не нужно; текст для скринридера — opts.label. opts.reset — вернуть исходный вид через N мс.
   */
  function success(btn, opts) {
    opts = opts || {};
    if (btn.classList.contains("fx-btn-success")) return;
    btn.setAttribute("data-fx-label", btn.innerHTML);
    btn.style.minWidth = btn.getBoundingClientRect().width + "px";
    btn.classList.add("fx-btn-success");
    btn.innerHTML = '<svg class="fx-btn-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg><span class="fx-sr">' + (opts.label || "Готово") + "</span>";
    announce(opts.label || "Готово");
    if (opts.reset) setTimeout(function () { resetSuccess(btn); }, opts.reset);
  }
  function resetSuccess(btn) {
    if (!btn.classList.contains("fx-btn-success")) return;
    btn.classList.remove("fx-btn-success");
    btn.innerHTML = btn.getAttribute("data-fx-label");
    btn.removeAttribute("data-fx-label");
    btn.style.minWidth = "";
  }

  /** Копирование: смена подписи на «Скопировано» на 1.6 с + объявление. */
  function copy(btn, text, labelEl) {
    var label = labelEl || btn;
    var original = label.textContent;
    var done = function () {
      label.textContent = "Скопировано";
      announce("Скопировано в буфер обмена");
      pop(btn);
      setTimeout(function () { label.textContent = original; }, 1600);
    };
    try {
      navigator.clipboard.writeText(text).then(done, function () { label.textContent = "Выделите и скопируйте"; });
    } catch (e) { label.textContent = "Выделите и скопируйте"; }
  }

  /** Короткий «поп» масштаба (лайк, чекбокс, значок). */
  function pop(el) {
    if (reduced()) return;
    el.classList.remove("fx-pop");
    void el.offsetWidth;
    el.classList.add("fx-pop");
  }

  /** Удар по счётчику: масштаб s→1 за ms (комбо, награда). */
  function punch(el, s, ms) {
    if (reduced() || !el.animate) return;
    el.animate([{ transform: "scale(" + (s || 1.3) + ")" }, { transform: "scale(1)" }],
      { duration: ms || 140, easing: "cubic-bezier(.34,1.56,.64,1)" });
  }

  /* ---------- Оверлеи ---------- */

  var liveRegion;
  function announce(text) {
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.setAttribute("role", "status");
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = "";
    setTimeout(function () { liveRegion.textContent = text; }, 30);
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
    t.textContent = message;
    t.setAttribute("data-state", "enter");
    toastHost.appendChild(t);
    while (toastHost.children.length > 3) toastHost.removeChild(toastHost.firstChild);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.removeAttribute("data-state"); }); });
    var timer, remaining = opts.duration || 4000, started = Date.now();
    var close = function () {
      t.setAttribute("data-state", "exit");
      setTimeout(function () { t.remove(); }, reduced() ? 0 : 300);
    };
    var run = function () { started = Date.now(); timer = setTimeout(close, remaining); };
    t.addEventListener("mouseenter", function () { clearTimeout(timer); remaining -= Date.now() - started; });
    t.addEventListener("mouseleave", run);
    run();
    return t;
  }

  /* ---------- Навигация ---------- */

  /** Скользящее подчёркивание вкладок: контейнер .fx-tabs с кнопками [role=tab] и .fx-tabs-ind. */
  function tabs(container) {
    var ind = container.querySelector(".fx-tabs-ind");
    var tabsEls = container.querySelectorAll("[role=tab]");
    function move(tab) {
      var c = container.getBoundingClientRect(), r = tab.getBoundingClientRect();
      ind.style.setProperty("--x", (r.left - c.left + container.scrollLeft) + "px");
      ind.style.setProperty("--w", r.width);
    }
    tabsEls.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabsEls.forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
        move(tab);
        if (container.onTabChange) container.onTabChange(tab);
      });
    });
    var sel = container.querySelector("[role=tab][aria-selected=true]") || tabsEls[0];
    if (sel) move(sel);
    window.addEventListener("resize", function () {
      var s = container.querySelector("[role=tab][aria-selected=true]");
      if (s) move(s);
    });
  }

  /* ---------- Числа ---------- */

  /** Плавный рост числа (KPI, монеты). Длительность растёт логарифмически от разницы. */
  function countUp(el, to, opts) {
    opts = opts || {};
    var from = opts.from != null ? opts.from : parseFloat(el.dataset.value || "0") || 0;
    var fmt = opts.format || function (v) { return Math.round(v).toLocaleString("ru-RU"); };
    el.dataset.value = to;
    el.setAttribute("aria-label", fmt(to));
    if (reduced()) { el.textContent = fmt(to); return; }
    var diff = Math.abs(to - from) || 1;
    var dur = opts.duration || clamp(350 + Math.log10(diff + 1) * 220, 350, 1200);
    var t0 = performance.now();
    (function step(now) {
      var p = clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
      else if (opts.punch !== false) punch(el, 1.15, 160);
    })(t0);
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
    setTimeout(function () { el.classList.remove(cls); }, ms || 2000);
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
   * Вспышка частиц в точке (x, y — координаты окна).
   * opts: count 12, colors [], speed 4, life 500, size 6, gravity 0, spread 360 (градусы), angle -90
   */
  function burst(x, y, opts) {
    opts = opts || {};
    if (reduced()) return;
    ensureCanvas();
    var n = opts.count || 12, colors = opts.colors || ["#fff"];
    var spread = (opts.spread == null ? 360 : opts.spread) * Math.PI / 180;
    var base = (opts.angle == null ? -90 : opts.angle) * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var a = base + (Math.random() - 0.5) * spread;
      var v = (opts.speed || 4) * (0.6 + Math.random() * 0.6);
      spawn({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: opts.gravity || 0, drag: opts.drag || 0.92,
        life: (opts.life || 500) * (0.7 + Math.random() * 0.5), size: (opts.size || 6) * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length], shape: opts.shape || "dot", rot: (opts.shape === "spark") ? a : Math.random() * 6, vr: (opts.shape === "spark") ? 0 : (Math.random() - 0.5) * 0.3
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  /** Конфетти: только для редких праздничных событий. */
  function confetti(x, y, colors) {
    burst(x == null ? innerWidth / 2 : x, y == null ? innerHeight * 0.35 : y, {
      count: 90, colors: colors || ["#f0a24b", "#5b9be6", "#5fbf72", "#e66f8c", "#f2d16b"],
      speed: 9, life: 1600, size: 9, gravity: 0.18, drag: 0.97, spread: 120, angle: -90, shape: "rect"
    });
  }

  /* ---------- Игровые эффекты ---------- */

  /**
   * Тряска по модели «травмы» (Eiserloh): shake = trauma², плавный шум, затухание decay/с.
   * Возвращает { add(amount) }. Трясите сцену, а не HUD.
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
    if (!el.animate) return;
    if (reduced()) {
      el.animate([{ outline: "3px solid #fff" }, { outline: "3px solid transparent" }], { duration: 200 });
      return;
    }
    el.animate([{ filter: "brightness(2.6) saturate(0)" }, { filter: "none" }], { duration: 90, easing: "steps(1, end)" });
  }

  /** Хитстоп: замораживает CSS/WAAPI-анимации элементов на ms (≈ 1 кадр = 16.7 мс). */
  function hitstop(ms, els) {
    var anims = [];
    (els || []).forEach(function (el) { if (el.getAnimations) anims = anims.concat(el.getAnimations({ subtree: true })); });
    anims.forEach(function (a) { try { a.pause(); } catch (e) {} });
    return new Promise(function (res) {
      setTimeout(function () { anims.forEach(function (a) { try { a.play(); } catch (e) {} }); res(); }, ms);
    });
  }

  /** Всплывающая цифра урона/лечения внутри position:relative-контейнера. */
  function damageNumber(container, x, y, value, opts) {
    opts = opts || {};
    var d = document.createElement("span");
    d.className = "fx-dmg" + (opts.crit ? " is-crit" : "") + (opts.heal ? " is-heal" : "") + (opts.kind ? " is-" + opts.kind : "");
    d.textContent = opts.text != null ? opts.text : (opts.heal ? "+" : "") + value + (opts.crit ? "!" : "");
    d.style.left = x + "px"; d.style.top = y + "px";
    d.style.setProperty("--dx", ((Math.random() - 0.5) * 40).toFixed(0) + "px");
    d.setAttribute("aria-hidden", "true");
    container.appendChild(d);
    setTimeout(function () { d.remove(); }, reduced() ? 700 : 900);
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
  }

  /** Сжатие и растяжение для прыжка (Celeste: 0.6×1.4 → 1.4×0.6 → 1). Центр у основания. */
  function squashJump(el, height) {
    if (reduced() || !el.animate) return;
    el.style.transformOrigin = "50% 100%";
    var h = height || 48;
    el.animate([
      { transform: "translateY(0) scale(1.25,.8)" },
      { transform: "translateY(" + -h + "px) scale(.75,1.3)", offset: 0.3 },
      { transform: "translateY(" + -h * 1.1 + "px) scale(1,1)", offset: 0.5 },
      { transform: "translateY(0) scale(1.35,.7)", offset: 0.82 },
      { transform: "translateY(0) scale(1,1)" }
    ], { duration: 620, easing: "ease-out" });
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
   * container — родитель, mutate — функция, меняющая DOM, key(el) — стабильный ключ (по умолчанию data-key).
   */
  function flip(container, mutate, opts) {
    opts = opts || {};
    var key = opts.key || function (el) { return el.getAttribute("data-key"); };
    var before = {};
    Array.prototype.forEach.call(container.children, function (el) {
      var k = key(el); if (k != null) before[k] = el.getBoundingClientRect();
    });
    mutate();
    if (reduced()) return;
    var entering = 0;
    Array.prototype.forEach.call(container.children, function (el) {
      if (!el.animate) return;
      var k = key(el), f = before[k], l = el.getBoundingClientRect();
      if (!f) {
        el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 260, delay: Math.min(entering++, 8) * 30, easing: "cubic-bezier(.2,0,0,1)", fill: "backwards" });
        return;
      }
      var dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }],
          { duration: opts.duration || 380, easing: "cubic-bezier(.2,0,0,1)" });
      }
    });
  }

  /** Плавная смена текста/содержимого (вкладки, значения): уход 120 мс, вход 200 мс. */
  function swap(el, content, isHTML) {
    var set = function () { if (isHTML) el.innerHTML = content; else el.textContent = content; };
    if (reduced() || !el.animate) { set(); return; }
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px)" }],
      { duration: 120, easing: "cubic-bezier(.3,0,1,1)" }).onfinish = function () {
      set();
      el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
        { duration: 200, easing: "cubic-bezier(.2,0,0,1)" });
    };
  }

  /**
   * Счёт чисел при первом показе: элементы с data-count="1234.5" (и data-decimals, data-prefix, data-suffix).
   * Текст в разметке — финальное значение, поэтому без JS всё корректно.
   */
  function countAll(selector, rootEl) {
    var els = (rootEl || document).querySelectorAll(selector || "[data-count]");
    Array.prototype.forEach.call(els, function (el, i) {
      var to = parseFloat(el.getAttribute("data-count"));
      if (isNaN(to)) return;
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "";
      var nf = new Intl.NumberFormat(document.documentElement.lang || "ru-RU", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      var fmt = function (v) { return pre + nf.format(v) + suf; };
      setTimeout(function () { countUp(el, to, { from: 0, format: fmt, punch: false, duration: el.getAttribute("data-duration") ? +el.getAttribute("data-duration") : 900 }); }, 150 + i * 60);
    });
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
    if (!document.startViewTransition || reduced()) { apply(); return; }
    document.startViewTransition(apply);
  }


  /**
   * Новое уведомление: колокольчик качается (800 мс), бейдж «выпрыгивает» и даёт кольцо-пульс.
   * bell — кнопка с классом .fx-bell и <svg>; badge — .fx-bell-badge (необязательно); count — новое число.
   */
  function ring(bell, badge, count) {
    if (badge && count != null) { badge.textContent = count > 99 ? "99+" : count; badge.hidden = !count; }
    once(bell, "is-ringing", 900);
    if (badge) once(badge, "is-pulsing", 1900);
    if (count != null) announce("Новых уведомлений: " + count);
  }


  /* ---------- Игровые слои эффектов ---------- */

  function place(layer, el, x, y, w, h) {
    el.style.left = (x - w / 2) + "px"; el.style.top = (y - h / 2) + "px";
    el.style.width = w + "px"; el.style.height = h + "px";
    layer.appendChild(el); return el;
  }
  function done(anim, el) { if (anim) anim.onfinish = function () { el.remove(); }; else setTimeout(function () { el.remove(); }, 400); }

  /** Цветная вспышка объекта (лечение — зелёная, яд — ядовитая, мороз — голубая): оттенок + свечение. */
  function tint(el, color, ms) {
    ms = ms || 520;
    var o = document.createElement("span"); o.className = "fx-tint"; o.style.background = color;
    el.appendChild(o);
    if (reduced() || !o.animate) { o.style.opacity = .55; setTimeout(function () { o.remove(); }, ms); return; }
    done(o.animate([{ opacity: 0 }, { opacity: .9, offset: .25 }, { opacity: 0 }], { duration: ms, easing: "ease-out" }), o);
    el.animate([{ filter: "drop-shadow(0 0 0 transparent)" }, { filter: "drop-shadow(0 0 16px " + color + ") brightness(1.15)", offset: .3 }, { filter: "drop-shadow(0 0 0 transparent)" }],
      { duration: ms * 1.2, easing: "ease-out" });
  }

  /** Кольцо-волна (ударная волна, лечение у ног, щит). Координаты — внутри layer. */
  function wave(layer, x, y, opts) {
    opts = opts || {}; if (reduced()) return;
    var s = opts.size || 140, el = document.createElement("span");
    el.className = "fx-wave"; el.style.borderColor = opts.color || "#fff"; el.style.borderWidth = (opts.width || 3) + "px";
    if (opts.squash) el.style.transform = "scaleY(" + opts.squash + ")";
    place(layer, el, x, y, s, s);
    done(el.animate([{ scale: ".15", opacity: 1 }, { scale: "1", opacity: 0 }], { duration: opts.ms || 450, easing: "cubic-bezier(.2,0,0,1)" }), el);
  }

  /** Радиальные линии удара (крит, тяжёлый удар). */
  function lines(layer, x, y, opts) {
    opts = opts || {}; if (reduced()) return;
    var n = opts.count || 14, r1 = opts.inner || 26, r2 = r1 + (opts.len || 70), size = (r2 + 10) * 2;
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", (-size / 2) + " " + (-size / 2) + " " + size + " " + size);
    svg.setAttribute("class", "fx-lines");
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.25, l = document.createElementNS(ns, "line");
      var rr = r2 - Math.random() * 20;
      l.setAttribute("x1", Math.cos(a) * r1); l.setAttribute("y1", Math.sin(a) * r1);
      l.setAttribute("x2", Math.cos(a) * rr); l.setAttribute("y2", Math.sin(a) * rr);
      l.setAttribute("stroke", opts.color || "#fff"); l.setAttribute("stroke-width", i % 3 ? 2 : 3.5); l.setAttribute("stroke-linecap", "round");
      svg.appendChild(l);
    }
    place(layer, svg, x, y, size, size);
    done(svg.animate([{ scale: ".55", opacity: 1 }, { scale: "1.25", opacity: 0 }], { duration: opts.ms || 240, easing: "cubic-bezier(.2,0,0,1)" }), svg);
  }

  /** Одиночная вспышка экрана (крит, получение урона). Одна вспышка, низкая прозрачность — безопасно (≤ 3 в секунду). */
  function flash(overlay, color, alpha, ms) {
    if (reduced() || !overlay.animate) return;
    overlay.style.background = color;
    overlay.animate([{ opacity: 0 }, { opacity: alpha == null ? .3 : alpha, offset: .2 }, { opacity: 0 }], { duration: ms || 200, easing: "ease-out" });
  }

  /** Короткий «наезд» камеры (зум-панч). Использует свойство scale, не мешает тряске через transform. */
  function zoom(el, s, ms) {
    if (reduced() || !el.animate) return;
    el.animate([{ scale: "1" }, { scale: String(s || 1.06), offset: .25 }, { scale: "1" }], { duration: ms || 280, easing: "cubic-bezier(.2,0,0,1)" });
  }

  /** Замедление времени: частицы и анимации элементов идут со скоростью rate на ms (реального времени). */
  function slowmo(rate, ms, els) {
    if (reduced()) return;
    timeScale = rate;
    var anims = [];
    (els || []).forEach(function (el) { if (el.getAnimations) anims = anims.concat(el.getAnimations({ subtree: true })); });
    anims.forEach(function (a) { a.playbackRate = rate; });
    setTimeout(function () { timeScale = 1; anims.forEach(function (a) { try { a.playbackRate = 1; } catch (e) {} }); }, ms);
  }

  /** Надпись-штамп по центру («КРИТ!», «УРОВЕНЬ 2», «ПОБЕДА»). */
  function stamp(layer, text, opts) {
    opts = opts || {};
    var el = document.createElement("div"); el.className = "fx-stamp"; el.textContent = text; el.setAttribute("aria-hidden", "true");
    if (opts.color) el.style.color = opts.color;
    if (opts.shadow) el.style.textShadow = opts.shadow;
    layer.appendChild(el);
    if (reduced() || !el.animate) { setTimeout(function () { el.remove(); }, 900); return; }
    done(el.animate([
      { scale: "2.4", opacity: 0 }, { scale: ".92", opacity: 1, offset: .14 }, { scale: "1", opacity: 1, offset: .22 },
      { scale: "1", opacity: 1, offset: .75 }, { scale: "1.08", opacity: 0, translate: "-50% -80%" }
    ], { duration: opts.ms || 1100, easing: "ease-out" }), el);
  }

  /** Остаточное изображение (рывок, уклонение): полупрозрачная копия гаснет за ms. */
  function afterimage(el, layer, opts) {
    opts = opts || {}; if (reduced()) return;
    var lr = layer.getBoundingClientRect(), r = el.getBoundingClientRect();
    var g = el.cloneNode(true); g.removeAttribute("id"); g.className = el.className + " fx-ghost";
    g.style.cssText = el.style.cssText;
    g.style.position = "absolute"; g.style.left = (r.left - lr.left) + "px"; g.style.top = (r.top - lr.top) + "px";
    g.style.width = r.width + "px"; g.style.height = r.height + "px"; g.style.bottom = "auto"; g.style.right = "auto";
    g.style.margin = "0"; g.style.transform = "none"; g.style.animation = "none"; g.style.opacity = "";
    if (opts.color) g.style.filter = "drop-shadow(0 0 0 " + opts.color + ") opacity(.8)";
    layer.appendChild(g);
    done(g.animate([{ opacity: opts.alpha || .45 }, { opacity: 0 }], { duration: opts.ms || 320, easing: "ease-out" }), g);
  }

  /** Световой столб (уровень, воскрешение). x — центр по горизонтали внутри layer. */
  function beam(layer, x, opts) {
    opts = opts || {}; if (reduced()) return;
    var w = opts.width || 56, el = document.createElement("span"); el.className = "fx-beam";
    el.style.left = (x - w / 2) + "px"; el.style.width = w + "px";
    el.style.background = "linear-gradient(to top, " + (opts.color || "rgb(255 220 120 / .85)") + ", transparent 85%)";
    layer.appendChild(el);
    done(el.animate([{ scale: "1 0", opacity: 1 }, { scale: "1 1", opacity: 1, offset: .25 }, { scale: ".6 1", opacity: 0 }], { duration: opts.ms || 900, easing: "ease-out" }), el);
  }

  /** Дрожь объекта во время хитстопа (метод Сакураи): затухающие сдвиги по X. */
  function jitter(el, ms, amp) {
    if (reduced() || !el.animate) return;
    var a = amp || 3, steps = Math.max(2, Math.round((ms || 80) / 16.7)), kf = [];
    for (var i = 0; i <= steps; i++) kf.push({ translate: (i === steps ? 0 : (i % 2 ? -1 : 1) * a * (1 - i / steps)) + "px 0" });
    el.animate(kf, { duration: ms || 80, easing: "linear" });
  }

  /** Монеты летят по дуге к счётчику; onEach вызывается при прилёте каждой (прибавить значение, «пинг»). */
  function flyTo(fromX, fromY, target, opts) {
    opts = opts || {};
    var n = opts.count || 6, tr = target.getBoundingClientRect(), tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    for (var i = 0; i < n; i++) (function (i) {
      if (reduced()) { if (opts.onEach) opts.onEach(i); return; }
      var c = document.createElement("span"); c.className = "fx-coin"; c.style.left = fromX + "px"; c.style.top = fromY + "px";
      document.body.appendChild(c);
      var dx = tx - fromX, dy = ty - fromY, spreadX = (Math.random() - .5) * 90, up = -60 - Math.random() * 50;
      var a = c.animate([
        { transform: "translate(0,0) scale(.6)" },
        { transform: "translate(" + spreadX + "px," + up + "px) scale(1)", offset: .3 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(.7)" }
      ], { duration: 620 + i * 40, delay: i * 70, easing: "cubic-bezier(.5,0,.75,0)", fill: "backwards" });
      a.onfinish = function () { c.remove(); if (opts.onEach) opts.onEach(i); };
    })(i);
  }

  window.fx = {
    reduced: reduced, systemReduced: systemReduced, setMotion: setMotion, shake: shake, fieldError: fieldError, clearFieldError: clearFieldError, check: check,
    loading: loading, success: success, resetSuccess: resetSuccess, copy: copy, pop: pop, punch: punch, announce: announce, toast: toast, tabs: tabs,
    countUp: countUp, stagger: stagger, once: once, burst: burst, confetti: confetti,
    trauma: trauma, hitFlash: hitFlash, hitstop: hitstop, damageNumber: damageNumber, health: health,
    squashJump: squashJump, sequence: sequence, flip: flip, swap: swap, countAll: countAll, themeSwitch: themeSwitch, ring: ring,
    tint: tint, wave: wave, lines: lines, flash: flash, zoom: zoom, slowmo: slowmo, stamp: stamp,
    afterimage: afterimage, beam: beam, jitter: jitter, flyTo: flyTo
  };
})();
