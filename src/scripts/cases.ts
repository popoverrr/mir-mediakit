// Фильтр кейсов (на клиенте, URL-хэш #cases/<категория>) и стрелки ленты featured.

export function initCases(): void {
  const root = document.querySelector<HTMLElement>('[data-cases]');
  if (!root) return;
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.ccard'));
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-group]'));
  const empty = root.querySelector<HTMLElement>('[data-cases-empty]');
  const status = root.querySelector<HTMLElement>('[data-cases-status]');
  const rail = root.querySelector<HTMLElement>('[data-rail]');

  const apply = (cat: string, fromUser: boolean) => {
    if (!chips.some((c) => c.dataset.filter === cat)) cat = 'all';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === cat)));
    let shown = 0;
    cards.forEach((card) => {
      const on = cat === 'all' || card.dataset.cat === cat;
      card.hidden = !on;
      if (on) shown++;
    });
    groups.forEach((g) => {
      g.hidden = !g.querySelector('.ccard:not([hidden])');
    });
    if (empty) empty.hidden = shown > 0;
    if (rail) rail.scrollTo({ left: 0 });
    updateArrows();
    if (status && fromUser) {
      const chip = chips.find((c) => c.dataset.filter === cat);
      status.textContent = `${chip?.firstChild?.textContent?.trim() ?? ''}: ${shown}`;
    }
    if (fromUser) {
      const hash = cat === 'all' ? '#cases' : `#cases/${cat}`;
      history.replaceState(null, '', hash);
    }
  };

  chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter!, true)));

  const fromHash = () => {
    const m = /^#cases(?:\/([\w-]+))?$/.exec(location.hash);
    if (!m) return false;
    apply(m[1] ?? 'all', false);
    return true;
  };
  if (fromHash() && location.hash.includes('/')) {
    // якорь с категорией браузер не найдёт сам — прокручиваем к блоку
    requestAnimationFrame(() => root.scrollIntoView());
  }
  window.addEventListener('hashchange', fromHash);

  // стрелки
  const prev = root.querySelector<HTMLButtonElement>('[data-rail-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-rail-next]');
  function updateArrows() {
    if (!rail || !prev || !next) return;
    const max = rail.scrollWidth - rail.clientWidth - 2;
    prev.disabled = rail.scrollLeft <= 2;
    next.disabled = rail.scrollLeft >= max;
  }
  const step = (dir: number) => {
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>('.ccard:not([hidden])');
    const w = card ? card.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: dir * w * Math.max(1, Math.floor(rail.clientWidth / w)), behavior: 'smooth' });
  };
  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));
  rail?.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
}
