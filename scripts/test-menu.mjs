// Мобильное меню: Chromium и WebKit × профили iPhone 13 и Pixel 7.
//   node scripts/test-menu.mjs [baseUrl] [--shots dir]
// Сценарии: открыть наверху; открыть после скролла до «Кейсов»; перейти по каждому пункту;
// закрыть через Esc, «×» и тап мимо пунктов. Проверяются видимость всех пунктов, aria-expanded,
// фокус, scroll-lock, скрытая липкая кнопка и ссылка «Написать менеджеру».
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? 'http://127.0.0.1:4351').replace(/\/$/, '');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const MANAGER = 'https://t.me/ibragimai';
const IDS = ['about', 'cases', 'stats', 'formats', 'contacts'];

let total = 0;
let failed = 0;
const ok = (name, cond, info = '') => {
  total++;
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${name}${info ? ` — ${info}` : ''}`);
};

async function menuState(page) {
  return page.evaluate(() => {
    const menu = document.getElementById('nav-menu');
    const burger = document.querySelector('[data-burger]');
    const vh = window.innerHeight;
    const links = [...menu.querySelectorAll('[data-menu-link]')].map((a) => {
      const r = a.getBoundingClientRect();
      return { id: a.getAttribute('href'), top: r.top, bottom: r.bottom, h: r.height, visible: r.height >= 48 && r.top >= 0 && r.bottom <= vh + 1 };
    });
    const mr = menu.getBoundingClientRect();
    const cta = menu.querySelector('.menu__cta');
    const cr = cta?.getBoundingClientRect();
    const lang = menu.querySelector('.lang--menu');
    const lr = lang?.getBoundingClientRect();
    const hit = document.elementFromPoint(innerWidth / 2, mr.top + 40);
    return {
      hidden: menu.hidden,
      expanded: burger.getAttribute('aria-expanded'),
      menuTop: mr.top,
      menuH: mr.height,
      vh,
      links,
      ctaHref: cta?.getAttribute('href'),
      ctaVisible: !!cr && cr.height > 0 && cr.bottom <= vh + 1,
      langVisible: !!lr && lr.height > 0 && lr.bottom <= vh + 1,
      stickyShown: getComputedStyle(document.querySelector('[data-sticky-cta]')).display !== 'none',
      topHitInMenu: menu.contains(hit),
      focusInMenu: menu.contains(document.activeElement) || document.activeElement === burger,
    };
  });
}

const runs = [
  { engine: chromium, eName: 'Chromium', profile: 'Pixel 7' },
  { engine: chromium, eName: 'Chromium', profile: 'iPhone 13' },
  { engine: webkit, eName: 'WebKit', profile: 'iPhone 13' },
  { engine: webkit, eName: 'WebKit', profile: 'Pixel 7' },
];

for (const run of runs) {
  const tag = `${run.eName}/${run.profile}`;
  const browser = await run.engine.launch();
  const { defaultBrowserType: _d, ...device } = devices[run.profile];
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });

  const check = async (label) => {
    const s = await menuState(page);
    ok(`${tag}: ${label} — меню открыто, aria-expanded`, !s.hidden && s.expanded === 'true');
    ok(`${tag}: ${label} — меню на весь экран под шапкой`, s.menuTop >= 50 && s.menuTop <= 80 && s.menuH >= s.vh - s.menuTop - 2, `top ${Math.round(s.menuTop)}, h ${Math.round(s.menuH)}/${s.vh}`);
    ok(`${tag}: ${label} — видны все 5 пунктов ≥ 48 px`, s.links.length === 5 && s.links.every((x) => x.visible), s.links.map((x) => `${x.id}:${Math.round(x.top)}`).join(' '));
    ok(`${tag}: ${label} — RU/EN и «Написать менеджеру» видны`, s.langVisible && s.ctaVisible && s.ctaHref === MANAGER);
    ok(`${tag}: ${label} — меню перекрывает контент`, s.topHitInMenu);
    ok(`${tag}: ${label} — липкая кнопка скрыта, фокус в меню`, !s.stickyShown && s.focusInMenu);
    return s;
  };

  // 1. наверху
  await page.locator('[data-burger]').tap();
  await page.waitForTimeout(500);
  await check('наверху');
  if (shots) await page.screenshot({ path: path.join(shots, `menu-${run.eName}-${run.profile.replace(/\s/g, '')}-top.jpg`), type: 'jpeg', quality: 80 });
  // закрыть «×»
  await page.locator('[data-burger]').tap();
  await page.waitForTimeout(300);
  let st = await menuState(page);
  ok(`${tag}: «×» закрывает, фокус на бургере`, st.hidden && st.expanded === 'false' && (await page.evaluate(() => document.activeElement?.hasAttribute('data-burger'))));

  // 2. после скролла до «Кейсов» + scroll-lock
  await page.evaluate(() => document.getElementById('cases').scrollIntoView({ behavior: 'instant' }));
  await page.waitForTimeout(500);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.locator('[data-burger]').tap();
  await page.waitForTimeout(500);
  await check('после скролла');
  if (shots) await page.screenshot({ path: path.join(shots, `menu-${run.eName}-${run.profile.replace(/\s/g, '')}-scrolled.jpg`), type: 'jpeg', quality: 80 });
  // Esc
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  st = await menuState(page);
  const y1 = await page.evaluate(() => window.scrollY);
  ok(`${tag}: Esc закрывает, позиция страницы сохранена`, st.hidden && Math.abs(y1 - y0) < 4, `${Math.round(y0)} → ${Math.round(y1)}`);

  // тап мимо пунктов
  await page.locator('[data-burger]').tap();
  await page.waitForTimeout(400);
  const box = await page.locator('.menu__foot').boundingBox();
  await page.touchscreen.tap(20, box.y - 12);
  await page.waitForTimeout(300);
  st = await menuState(page);
  ok(`${tag}: тап мимо пунктов закрывает`, st.hidden);

  // 3. переход по каждому пункту
  for (const id of IDS) {
    await page.locator('[data-burger]').tap();
    await page.waitForTimeout(350);
    await page.locator(`#nav-menu [data-menu-link][href="#${id}"]`).tap();
    await page.waitForTimeout(1200);
    const r = await page.evaluate((sid) => {
      const top = document.getElementById(sid).getBoundingClientRect().top;
      const navH = document.querySelector('.nav').getBoundingClientRect().height;
      return { top, navH, hidden: document.getElementById('nav-menu').hidden, hash: location.hash };
    }, id);
    ok(`${tag}: пункт #${id} — меню закрыто, раздел под шапкой`, r.hidden && r.top >= r.navH - 2 && r.top <= r.navH + 40 && r.hash === `#${id}`, `top ${Math.round(r.top)}, шапка ${Math.round(r.navH)}`);
  }
  ok(`${tag}: нет ошибок JS`, errors.length === 0, errors.join(' | '));
  await browser.close();
}

console.log(`\n${total - failed}/${total} проверок меню пройдено`);
if (failed) process.exitCode = 1;
