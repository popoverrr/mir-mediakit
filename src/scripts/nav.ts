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
  const onScroll = () => nav?.classList.toggle('is-glass', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // бургер и полноэкранное меню
  const root = document.documentElement;
  const isOpen = () => burger?.getAttribute('aria-expanded') === 'true';
  let lockedY = 0;
  // scroll-lock без прыжка позиции на iOS: body фиксируется на текущем смещении и возвращается при закрытии
  const lock = () => {
    lockedY = window.scrollY;
    root.classList.add('menu-open');
    Object.assign(document.body.style, { position: 'fixed', top: `-${lockedY}px`, left: '0', right: '0', width: '100%' });
  };
  const unlock = () => {
    root.classList.remove('menu-open');
    Object.assign(document.body.style, { position: '', top: '', left: '', right: '', width: '' });
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, lockedY);
    root.style.scrollBehavior = prev;
  };
  const focusables = () =>
    [burger, ...Array.from(menu?.querySelectorAll<HTMLElement>('a[href], button') ?? [])].filter(Boolean) as HTMLElement[];
  const openMenu = () => {
    if (!burger || !menu || isOpen()) return;
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', burger.dataset.labelClose ?? '');
    menu.hidden = false;
    lock();
    onScroll();
    menu.querySelector<HTMLElement>('[data-menu-link]')?.focus({ preventScroll: true });
  };
  const closeMenu = (focusBurger = true) => {
    if (!burger || !menu || !isOpen()) return;
    burger.setAttribute('aria-expanded', 'false');
    burger.removeAttribute('aria-label');
    menu.hidden = true;
    unlock();
    onScroll();
    if (focusBurger) burger.focus({ preventScroll: true });
  };
  burger?.addEventListener('click', () => (isOpen() ? closeMenu() : openMenu()));
  // пункт меню: закрыть, затем плавно к якорю (scroll-padding учитывает высоту шапки)
  menu?.querySelectorAll<HTMLAnchorElement>('[data-menu-link]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!.slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      closeMenu(false);
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
      burger?.focus({ preventScroll: true });
    }),
  );
  // тап мимо пунктов закрывает
  menu?.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('a, button')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      return;
    }
    // фокус не уходит за пределы меню (бургер + пункты)
    if (e.key === 'Tab') {
      const f = focusables();
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0)) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) {
        e.preventDefault();
        f[0].focus();
      }
    }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) closeMenu(false);
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
