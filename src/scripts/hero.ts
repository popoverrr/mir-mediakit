// Обложка: наклон телефонов от курсора (≤ 6°) и пауза SVG-анимаций ленты при reduced-motion.
import { canHover, reduceMotion } from './env';

export function initHero(): void {
  const ribbons = document.querySelectorAll<SVGSVGElement>('svg.ribbon');
  if (reduceMotion()) {
    ribbons.forEach((s) => s.pauseAnimations?.());
    return;
  }
  const hero = document.getElementById('top');
  // лента за пределами экрана не анимируется
  if (hero && 'IntersectionObserver' in window)
    new IntersectionObserver(([en]) => {
      ribbons.forEach((s) => (en.isIntersecting ? s.unpauseAnimations?.() : s.pauseAnimations?.()));
    }).observe(hero);

  const visual = document.querySelector<HTMLElement>('[data-tilt]');
  if (!visual || !hero || !canHover()) return;
  const MAX = 6;
  let raf = 0;
  let tx = 0;
  let ty = 0;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        visual.style.setProperty('--ry', `${(tx * MAX).toFixed(2)}deg`);
        visual.style.setProperty('--rx', `${(-ty * MAX * 0.6).toFixed(2)}deg`);
      });
  });
  hero.addEventListener('pointerleave', () => {
    visual.style.setProperty('--ry', '0deg');
    visual.style.setProperty('--rx', '0deg');
  });
}
