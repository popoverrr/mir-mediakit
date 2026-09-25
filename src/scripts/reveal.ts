// Появление блоков: fade + translateY(24px), 600 мс, stagger 60 мс (через --i в разметке).
import { reduceMotion } from './env';

export function initReveal(): void {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
  );
  els.forEach((e) => io.observe(e));
}
