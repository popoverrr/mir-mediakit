// Проверка интерактива: фильтры кейсов + хэш, модалка (видео/embed, стрелки, Esc, фокус), превью, языки.
//   node scripts/test-interact.mjs [baseUrl] [--shots docs/screens]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? 'http://127.0.0.1:4351').replace(/\/$/, '');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const results = [];
const ok = (name, cond, info = '') => {
  results.push({ name, pass: !!cond, info });
  console.log(`${cond ? '✓' : '✗'} ${name}${info ? ` — ${info}` : ''}`);
};

const browser = await chromium.launch();

// ---------- десктоп
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const iframeRequests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => {
    if (/youtube|tiktok\.com\/player|instagram\.com\/reel/.test(r.url())) iframeRequests.push(r.url());
  });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  ok('нет iframe соцсетей до клика', iframeRequests.length === 0 && (await page.locator('iframe').count()) === 0, `${iframeRequests.length} запросов`);

  // фильтр
  await page.locator('#cases').scrollIntoViewIfNeeded();
  const total = await page.locator('.ccard').count();
  await page.click('[data-filter="skincare"]');
  const visible = await page.locator('.ccard:not([hidden])').count();
  const cats = await page.$$eval('.ccard:not([hidden])', (els) => [...new Set(els.map((e) => e.dataset.cat))]);
  ok('фильтр «Уход и косметика»', visible > 0 && visible < total && cats.length === 1 && cats[0] === 'skincare', `${visible}/${total}`);
  ok('хэш #cases/skincare', (await page.evaluate(() => location.hash)) === '#cases/skincare');
  await page.click('[data-filter="art"]');
  const featuredHidden = await page.locator('[data-group="featured"]').evaluate((e) => e.hidden);
  ok('пустая группа featured скрыта при фильтре «Арт»', featuredHidden);
  if (shots) await page.locator('#cases').screenshot({ path: path.join(shots, 'desktop-cases-filter-art.png') });
  await page.click('[data-filter="all"]');
  ok('«Все» возвращает все кейсы', (await page.locator('.ccard:not([hidden])').count()) === total);

  // модалка: кейс с локальным видео
  await page.locator('.ccard--lg .ccard__btn').first().click();
  await page.waitForSelector('dialog[open]');
  const hasVideo = await page.locator('dialog [data-player] video').count();
  ok('модалка открылась с локальным видео', hasVideo === 1);
  const vstate = await page.locator('dialog [data-player] video').evaluate(
    (v) =>
      new Promise((res) => {
        const done = () => res({ rs: v.readyState, src: v.currentSrc, dur: v.duration });
        if (v.readyState >= 1) done();
        else v.addEventListener('loadedmetadata', done, { once: true });
        setTimeout(done, 5000);
      }),
  );
  ok('видео загружается (metadata)', vstate.rs >= 1 && vstate.dur > 0, `${Math.round(vstate.dur)} с`);
  const title1 = await page.locator('#vm-title').textContent();
  const metrics = await page.locator('dialog [data-metrics] > div').count();
  ok('таблица метрик заполнена', metrics >= 1, `${metrics} метрик`);
  const listItems = await page.locator('dialog [data-list] li').count();
  ok('список роликов кампании', listItems >= 1, `${listItems}`);
  if (shots) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(shots, 'desktop-modal.png') });
  }
  await page.keyboard.press('ArrowRight');
  const title2 = await page.locator('#vm-title').textContent();
  ok('стрелка → переключает кейс', title2 !== title1, `${title1} → ${title2}`);
  await page.keyboard.press('ArrowLeft');
  ok('стрелка ← возвращает', (await page.locator('#vm-title').textContent()) === title1);
  // переключить на embed-источник (второй в списке, если есть)
  const sw = page.locator('dialog [data-switch]');
  if ((await sw.count()) > 1) {
    await sw.nth(1).click();
    const fr = await page.locator('dialog [data-player] iframe').count();
    ok('▶ в списке переключает плеер на embed', fr === 1);
  }
  // фокус внутри
  const focusInside = await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement));
  ok('фокус внутри модалки', focusInside);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok('Esc закрывает, плеер очищен', !(await page.locator('dialog[open]').count()) && (await page.locator('[data-player] *').count()) === 0);

  // кейс без скачанного ролика → embed/ссылка
  await page.click('[data-filter="art"]');
  await page.locator('.ccard:not([hidden]) .ccard__btn').first().click();
  await page.waitForSelector('dialog[open]');
  const kind = await page.evaluate(() => {
    const p = document.querySelector('[data-player]');
    return p.querySelector('video') ? 'video' : p.querySelector('iframe') ? 'iframe:' + p.querySelector('iframe').src : p.querySelector('.vm__facade') ? 'link' : 'empty';
  });
  ok('GSJJ (IG без скачивания) → embed', kind.startsWith('iframe:https://www.instagram.com/reel/'), kind);
  await page.click('[data-close]');
  await page.click('[data-filter="all"]');

  // знакомство
  await page.click('[data-open-item="intro"]');
  await page.waitForSelector('dialog[open]');
  ok('«Смотреть знакомство» открывает ролик', (await page.locator('dialog [data-player] video, dialog [data-player] iframe').count()) === 1);
  ok('у знакомства скрыт список кампании', await page.locator('[data-list-wrap]').evaluate((e) => getComputedStyle(e).display === 'none'));
  await page.keyboard.press('Escape');

  // вирусное
  await page.locator('.tcard__btn').nth(2).click();
  await page.waitForSelector('dialog[open]');
  ok('вирусный ролик открывается в модалке', (await page.locator('dialog [data-player] video').count()) === 1);
  // клик по фону закрывает
  await page.mouse.click(10, 450);
  await page.waitForTimeout(200);
  ok('клик по фону закрывает', !(await page.locator('dialog[open]').count()));

  // превью по наведению
  await page.locator('#cases').scrollIntoViewIfNeeded();
  const firstCard = page.locator('.ccard--lg .ccard__btn').first();
  await firstCard.hover();
  await page.waitForTimeout(1500);
  const playing = await page.$$eval('video.ccard__preview.is-playing', (v) => v.length);
  ok('превью играет при наведении', playing >= 1, `${playing}`);
  const muted = await page.$$eval('video.ccard__preview', (vs) => vs.every((v) => v.muted));
  ok('превью без звука', muted);

  // язык сохраняет якорь
  await page.goto(base + '/#formats', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const enHref = await page.locator('.lang a[hreflang="en"]').getAttribute('href');
  ok('ссылка EN сохраняет якорь раздела', /#formats$/.test(enHref ?? ''), enHref ?? '');

  ok('нет ошибок JS (десктоп)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------- мобайл
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/en/', { waitUntil: 'networkidle' });
  ok('EN: html lang', (await page.getAttribute('html', 'lang')) === 'en');
  // бургер
  await page.click('[data-burger]');
  ok('бургер открывает меню', await page.locator('[data-menu]').isVisible());
  if (shots) await page.screenshot({ path: path.join(shots, 'mobile-en-menu.png') });
  await page.locator('[data-menu] a[href="#cases"]').click();
  await page.waitForTimeout(900);
  ok('пункт меню закрывает меню', !(await page.locator('[data-menu]').isVisible()));
  // липкая кнопка
  const stickyOn = await page.locator('[data-sticky-cta]').evaluate((e) => e.classList.contains('is-on'));
  ok('липкая кнопка Telegram после первого экрана', stickyOn);
  // превью по видимости
  await page.waitForTimeout(1500);
  const playing = await page.$$eval('video.ccard__preview.is-playing, .tcard video.is-playing', (v) => v.length);
  ok('на телефоне играют ≤ 2 превью', playing <= 2, `${playing}`);
  // модалка + свайп вниз
  await page.locator('.ccard--lg .ccard__btn').first().tap();
  await page.waitForSelector('dialog[open]');
  if (shots) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, 'mobile-en-modal.png') });
  }
  const box = await page.locator('.vm__side').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const x = 180;
  const y0 = Math.round(box.y + 20);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + i * 25 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  ok('свайп вниз закрывает модалку', !(await page.locator('dialog[open]').count()));
  ok('нет ошибок JS (мобайл)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} проверок пройдено`);
if (failed.length) process.exitCode = 1;
