// ESM-обёртка над effects.js: import fx, { toast, flip } from "./effects.mjs";
// Сам effects.js остаётся обычным скриптом (window.fx) — подключается и через <script>, и через import.
import "./effects.js";

const fx = window.fx;
export default fx;
export const {
  version, reduced, systemReduced, setMotion, setStrings, center,
  shake, fieldError, clearFieldError, check, loading, success, resetSuccess, copy, pop, punch, announce, toast, tabs,
  countUp, stagger, once, burst, confetti,
  trauma, hitFlash, hitstop, damageNumber, health,
  squashJump, sequence, flip, swap, countAll, themeSwitch, ring,
  tint, wave, lines, flash, zoom, slowmo, stamp,
  afterimage, beam, jitter, flyTo,
  sheet, swipeToDelete, stream, odometer, viewTransition
} = fx;
