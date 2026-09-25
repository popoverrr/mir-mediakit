// Модалка кейса / ролика. Плеер: локальный mp4 → embed YouTube/TikTok/Instagram → постер + ссылка.
// Никаких iframe до клика: плеер создаётся только при открытии.
import { countCompact, countInt, fmtCompact, fmtInt, fmtMonth, type Locale, type PluralForms } from '../lib/format';
import { pauseAllPreviews } from './previews';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'telegram';
type Player =
  | { kind: 'video'; src: string; poster?: string }
  | { kind: 'iframe'; src: string; platform: Platform }
  | { kind: 'link'; url: string; platform: Platform };
interface Stats {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
}
interface Video {
  platform: Platform;
  url: string;
  date: string | null;
  stats: Stats;
  player: Player;
  blocked?: boolean;
  title?: string;
}
interface Item {
  id: string;
  type: 'case' | 'top';
  title: string;
  brandUrl?: string;
  handle?: string;
  category?: string;
  summary?: string;
  totals?: string;
  poster?: string;
  videos: Video[];
}
interface Payload {
  locale: Locale;
  items: Item[];
  t: Record<string, string> & {
    units: Record<string, PluralForms>;
    platformName: Record<string, string>;
  };
}

const ICON: Record<string, string> = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function initModal(): void {
  const found = document.querySelector<HTMLDialogElement>('[data-modal]');
  const dataEl = document.getElementById('mk-data');
  if (!found || !dataEl || typeof found.showModal !== 'function') return;
  const dialog: HTMLDialogElement = found;
  const data = JSON.parse(dataEl.textContent || '{}') as Payload;
  const { t, locale: l } = data;
  const byId = new Map(data.items.map((it) => [it.id, it]));
  // иконки платформ берём из уже отрисованных SVG на странице
  const pfIcon = (p: string) => {
    const svg = document.querySelector(`svg.ico--${p}`);
    return svg ? svg.outerHTML.replace(/<title>.*?<\/title>/, '').replace(/role="img"|aria-label="[^"]*"/g, '') : '';
  };

  const $ = <T extends HTMLElement>(sel: string) => dialog.querySelector<T>(sel)!;
  const wrap = $('.vm__wrap');
  const player = $('[data-player]');
  const elCat = $('[data-cat]');
  const elTitle = $('[data-title]');
  const elHandle = $('[data-handle]');
  const elSummary = $('[data-summary]');
  const elTotals = $('[data-totals]');
  const elMetrics = $('[data-metrics]');
  const elDate = $('[data-date]');
  const elList = $('[data-list]');
  const btnPrev = $<HTMLButtonElement>('[data-prev]');
  const btnNext = $<HTMLButtonElement>('[data-next]');
  const btnClose = $<HTMLButtonElement>('[data-close]');

  let current: Item | null = null;
  let videoIdx = 0;
  let order: string[] = [];
  let opener: HTMLElement | null = null;

  const fmtStat = (n: number) => (n >= 10000 ? fmtCompact(n, l) : fmtInt(n, l));

  function renderPlayer(v: Video, poster?: string): void {
    player.innerHTML = '';
    const p = v.player;
    if (p.kind === 'video') {
      const el = document.createElement('video');
      el.controls = true;
      el.playsInline = true;
      el.preload = 'metadata';
      if (p.poster) el.poster = p.poster;
      el.src = p.src;
      player.append(el);
      // открытие — это клик пользователя, поэтому запускаем со звуком; если браузер против — останутся controls
      el.play().catch(() => undefined);
      return;
    }
    if (p.kind === 'iframe') {
      const loading = document.createElement('p');
      loading.className = 'vm__loading';
      loading.textContent = t.loading;
      const fr = document.createElement('iframe');
      fr.src = p.src;
      fr.title = `${t.platformName[p.platform] ?? p.platform}: ${current?.title ?? ''}`;
      fr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write';
      fr.allowFullscreen = true;
      fr.referrerPolicy = 'strict-origin-when-cross-origin';
      fr.addEventListener('load', () => loading.remove());
      player.append(fr, loading);
      return;
    }
    const name = t.platformName[p.platform] ?? p.platform;
    player.innerHTML = `<div class="vm__facade">${poster ? `<img src="${esc(poster)}" alt="">` : ''}<a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t.watchOn.replace('{platform}', name))} ${ICON.out}</a></div>`;
  }

  function renderMetrics(v: Video): void {
    const rows: [string, number][] = [];
    const s = v.stats || {};
    if (s.views) rows.push([t.views, s.views]);
    if (s.likes) rows.push([t.likes, s.likes]);
    if (s.comments) rows.push([t.comments, s.comments]);
    if (s.shares) rows.push([t.shares, s.shares]);
    if (s.saves) rows.push([t.saves, s.saves]);
    elMetrics.innerHTML = rows.length
      ? rows.map(([k, n]) => `<div><dt>${esc(k)}</dt><dd>${esc(fmtStat(n))}</dd></div>`).join('')
      : `<p class="vm__metrics-empty">${esc(v.blocked ? t.blocked : t.noStats)}</p>`;
    const month = fmtMonth(v.date, l);
    elDate.textContent = [t.platformName[v.platform] ?? v.platform, month].filter(Boolean).join(' · ');
  }

  function renderList(item: Item): void {
    elList.innerHTML = item.videos
      .map((v, i) => {
        const name = t.platformName[v.platform] ?? v.platform;
        const s = v.stats || {};
        const views = s.views
          ? countCompact(s.views, l, t.units.views)
          : s.likes
            ? countInt(s.likes, l, t.units.likes)
            : v.blocked
              ? t.blocked
              : '';
        const month = fmtMonth(v.date, l);
        const sub = [month, v.title].filter(Boolean).join(' · ');
        const cur = i === videoIdx;
        return `<li class="vm__item${cur ? ' is-current' : ''}">
          <span class="vm__item-pf">${pfIcon(v.platform)}</span>
          <span class="vm__item-main"><b>${esc(name)}${views ? ` · ${esc(views)}` : ''}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>
          <button type="button" class="vm__ibtn" data-switch="${i}" aria-pressed="${cur}" aria-label="${esc(t.play)}: ${esc(name)}${month ? `, ${esc(month)}` : ''}">${ICON.play}</button>
          <a class="vm__ibtn" href="${esc(v.url)}" target="_blank" rel="noopener" aria-label="${esc(t.original)}: ${esc(name)}">${ICON.out}</a>
        </li>`;
      })
      .join('');
  }

  function showVideo(i: number): void {
    if (!current) return;
    videoIdx = Math.max(0, Math.min(i, current.videos.length - 1));
    const v = current.videos[videoIdx];
    if (!v) return;
    renderPlayer(v, current.poster);
    renderMetrics(v);
    renderList(current);
  }

  function computeOrder(item: Item): string[] {
    if (item.type === 'case') {
      return Array.from(document.querySelectorAll<HTMLElement>('.ccard:not([hidden])'))
        .map((el) => el.dataset.case!)
        .filter(Boolean);
    }
    if (item.id === 'intro') return [];
    return Array.from(document.querySelectorAll<HTMLElement>('.tcard'))
      .map((el) => el.dataset.case!)
      .filter(Boolean);
  }

  function fill(item: Item): void {
    current = item;
    dialog.classList.toggle('is-top', item.type === 'top');
    elCat.textContent = item.category ?? '';
    elTitle.textContent = item.title;
    elHandle.textContent = '';
    if (item.brandUrl && item.handle) {
      const a = document.createElement('a');
      a.href = item.brandUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `@${item.handle}`;
      elHandle.append(a);
    }
    elSummary.textContent = item.summary ?? '';
    elTotals.textContent = item.totals ?? '';
    const idx = order.indexOf(item.id);
    btnPrev.hidden = btnNext.hidden = order.length < 2 || idx < 0;
    showVideo(0);
    wrap.scrollTop = 0;
  }

  function open(id: string, from: HTMLElement | null): void {
    const item = byId.get(id);
    if (!item) return;
    pauseAllPreviews();
    opener = from;
    order = computeOrder(item);
    fill(item);
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('vm-lock');
    }
    btnClose.focus({ preventScroll: true });
    // showModal() мог прокрутить панель к первому фокусируемому элементу — возвращаем к началу
    wrap.scrollTop = 0;
    requestAnimationFrame(() => (wrap.scrollTop = 0));
  }

  function close(): void {
    player.innerHTML = '';
    if (dialog.open) dialog.close();
    document.documentElement.classList.remove('vm-lock');
    wrap.style.transform = '';
    current = null;
    opener?.focus({ preventScroll: true });
  }

  function step(dir: number): void {
    if (!current || order.length < 2) return;
    const idx = order.indexOf(current.id);
    if (idx < 0) return;
    const nextId = order[(idx + dir + order.length) % order.length];
    const item = byId.get(nextId);
    if (item) fill(item);
  }

  // открытие
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-open-item]');
    if (!btn) return;
    e.preventDefault();
    open(btn.dataset.openItem!, btn);
  });

  // управление
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', () => step(-1));
  btnNext.addEventListener('click', () => step(1));
  elList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-switch]');
    if (!b) return;
    const i = Number(b.dataset.switch);
    showVideo(i);
    // список перерисован — возвращаем фокус на ту же кнопку
    elList.querySelector<HTMLElement>(`[data-switch="${i}"]`)?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // клик по фону (вне карточки)
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tag !== 'VIDEO' && tag !== 'INPUT') {
      e.preventDefault();
      step(e.key === 'ArrowLeft' ? -1 : 1);
    }
    // фокус-ловушка
    if (e.key === 'Tab') {
      const f = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([hidden]), a[href], video[controls], iframe, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null || el.tagName === 'IFRAME');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // свайп вниз на мобиле — закрыть
  let y0 = 0;
  let dy = 0;
  let tracking = false;
  wrap.addEventListener(
    'touchstart',
    (e) => {
      if (window.innerWidth >= 900 || wrap.scrollTop > 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('iframe, .vm__list')) return;
      tracking = true;
      y0 = e.touches[0].clientY;
      dy = 0;
      wrap.style.transition = 'none';
    },
    { passive: true },
  );
  wrap.addEventListener(
    'touchmove',
    (e) => {
      if (!tracking) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      wrap.style.transform = dy ? `translateY(${dy}px)` : '';
    },
    { passive: true },
  );
  wrap.addEventListener('touchend', () => {
    if (!tracking) return;
    tracking = false;
    wrap.style.transition = '';
    if (dy > 110) close();
    else wrap.style.transform = '';
  });
}
