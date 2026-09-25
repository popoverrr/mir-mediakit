// Беззвучные превью карточек: на телефоне — в зоне видимости, на десктопе — при наведении.
// Одновременно играют максимум 2; src ставится только перед первым воспроизведением (preload="none").
import { canHover, reduceMotion, saveData } from './env';

const MAX_PLAYING = 2;
const playing: HTMLVideoElement[] = [];

function start(v: HTMLVideoElement): void {
  if (!v.src && v.dataset.src) v.src = v.dataset.src;
  const i = playing.indexOf(v);
  if (i >= 0) playing.splice(i, 1);
  playing.push(v);
  while (playing.length > MAX_PLAYING) stop(playing[0]);
  v.play()
    .then(() => v.classList.add('is-playing'))
    .catch(() => {
      /* автоплей запрещён — остаётся постер */
    });
}

function stop(v: HTMLVideoElement): void {
  const i = playing.indexOf(v);
  if (i >= 0) playing.splice(i, 1);
  v.pause();
  v.classList.remove('is-playing');
}

export function pauseAllPreviews(): void {
  [...playing].forEach(stop);
}

export function initPreviews(): void {
  if (reduceMotion() || saveData()) return;
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-src]'));
  if (!videos.length) return;

  if (canHover()) {
    for (const v of videos) {
      const host = v.closest('button');
      if (!host) continue;
      host.addEventListener('pointerenter', () => start(v));
      host.addEventListener('pointerleave', () => stop(v));
      host.addEventListener('focus', () => start(v));
      host.addEventListener('blur', () => stop(v));
    }
    return;
  }

  if (!('IntersectionObserver' in window)) return;
  const ratios = new Map<HTMLVideoElement, number>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const v = en.target.querySelector('video') as HTMLVideoElement | null;
        if (!v) continue;
        ratios.set(v, en.isIntersecting ? en.intersectionRatio : 0);
        if (!en.isIntersecting || en.intersectionRatio < 0.6) stop(v);
      }
      // играть две самые видимые
      const best = [...ratios.entries()]
        .filter(([, r]) => r >= 0.6)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_PLAYING)
        .map(([v]) => v);
      best.forEach((v) => {
        if (!playing.includes(v)) start(v);
      });
    },
    { threshold: [0, 0.6, 0.9] },
  );
  videos.forEach((v) => {
    const host = v.closest('button');
    if (host) io.observe(host);
  });
}
