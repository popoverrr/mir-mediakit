// Count-up цифр при появлении (1.2 с). Финальный текст — тот, что отрендерил сервер.
import { fmtCompact, fmtInt, fmtPlus } from '../lib/format';
import { locale, reduceMotion } from './env';

const DURATION = 1200;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

function run(el: HTMLElement): void {
  const target = Number(el.dataset.count);
  const mode = el.dataset.mode;
  const final = el.textContent ?? '';
  if (!Number.isFinite(target) || target <= 0) return;
  const l = locale();
  const fmt = (v: number) =>
    mode === 'plus' ? fmtPlus(Math.max(v, 1), l) : mode === 'compact' ? fmtCompact(v, l) : fmtInt(Math.round(v), l);
  // резервируем ширину, чтобы полоса не прыгала
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / DURATION);
    el.textContent = p < 1 ? fmt(target * ease(p)) : final;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initCounters(): void {
  if (reduceMotion() || !('IntersectionObserver' in window)) return;
  const els = document.querySelectorAll<HTMLElement>('[data-count]');
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        run(en.target as HTMLElement);
      }
    },
    { threshold: 0.5 },
  );
  els.forEach((e) => io.observe(e));
}
