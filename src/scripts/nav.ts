// Навигация: стекло при скролле, бургер, липкая кнопка Telegram, подсветка раздела,
// переключатель языка сохраняет якорь текущего раздела.

export function initNav(): void {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  const burger = document.querySelector<HTMLButtonElement>('[data-burger]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const sticky = document.querySelector<HTMLElement>('[data-sticky-cta]');
  const hero = document.getElementById('top');
  const contacts = document.getElementById('contacts');
  const langLinks = document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]');

  // стекло
  const onScroll = () => nav?.classList.toggle('is-glass', window.scrollY > 24 || burger?.getAttribute('aria-expanded') === 'true');
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // бургер
  const setMenu = (open: boolean) => {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    onScroll();
  };
  burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger?.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      burger.focus();
    }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
  });

  // липкая кнопка: после первого экрана, прячется у контактов
  if (sticky && hero && 'IntersectionObserver' in window) {
    let heroOut = false;
    let atContacts = false;
    const sync = () => {
      const on = heroOut && !atContacts;
      sticky.classList.toggle('is-on', on);
      sticky.setAttribute('aria-hidden', String(!on));
      sticky.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([en]) => {
      heroOut = !en.isIntersecting;
      sync();
    }).observe(hero);
    if (contacts)
      new IntersectionObserver(([en]) => {
        atContacts = en.isIntersecting;
        sync();
      }).observe(contacts);
  }

  // подсветка раздела + якорь для переключателя языка
  const spyLinks = new Map<string, HTMLAnchorElement>();
  document.querySelectorAll<HTMLAnchorElement>('[data-spy]').forEach((a) => spyLinks.set(a.dataset.spy!, a));
  const baseHref = new Map<HTMLAnchorElement, string>();
  langLinks.forEach((a) => baseHref.set(a, a.getAttribute('href')!.split('#')[0]));
  const setHash = (id: string | null) => {
    langLinks.forEach((a) => a.setAttribute('href', baseHref.get(a)! + (id ? `#${id}` : '')));
    spyLinks.forEach((a, key) => a.classList.toggle('is-active', key === id));
  };
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'));
  if ('IntersectionObserver' in window && sections.length) {
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) visible.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0);
        let best: string | null = null;
        let bestR = 0;
        visible.forEach((r, id) => {
          if (r > bestR) {
            bestR = r;
            best = id;
          }
        });
        setHash(best === 'top' ? null : best);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
  }
  // при клике на язык — взять актуальный хэш (например, #cases/skincare)
  langLinks.forEach((a) =>
    a.addEventListener('click', () => {
      const h = location.hash;
      if (h && h.length > 1) a.setAttribute('href', baseHref.get(a)! + h);
    }),
  );
}
