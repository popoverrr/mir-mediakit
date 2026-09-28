// Скриншоты «до/после» для правок 28.09.2026.
//   node scripts/shots-fixes.mjs <baseUrl> <before|after> [--out docs/screens/fixes-2026-09-28]
// Мобайл 375×812: открытое меню, кейсы, партнёры (со странами), контакты. Десктоп 1440×900: партнёры, контакты.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const base = (args[0] ?? 'http://127.0.0.1:4351').replace(/\/$/, '');
const tag = args[1] ?? 'after';
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/screens/fixes-2026-09-28';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
// фиксированные шапка / skip-link / липкая кнопка при съёмке высоких секций попадают в кадр случайно — прячем
const hideFixed = (page) =>
  page.addStyleTag({ content: '.nav, .skip-link, [data-sticky-cta] { visibility: hidden !important; }' });
const shotSection = async (page, sel, name) => {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await el.screenshot({ path: path.join(out, `${name}-${tag}.jpg`), type: 'jpeg', quality: 80 });
};

for (const [lang, p] of [['ru', '/'], ['en', '/en/']]) {
  // мобайл
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mp = await m.newPage();
  await mp.goto(`${base}${p}?v=${Date.now()}`, { waitUntil: 'networkidle' });
  await mp.evaluate(() => document.fonts.ready);
  if (lang === 'ru') {
    await mp.locator('[data-burger]').click();
    await mp.waitForTimeout(600);
    await mp.screenshot({ path: path.join(out, `mobile-menu-top-${tag}.jpg`), type: 'jpeg', quality: 80 });
    await mp.locator('[data-burger]').click();
    await mp.waitForTimeout(300);
    await mp.evaluate(() => document.getElementById('cases')?.scrollIntoView());
    await mp.waitForTimeout(600);
    await mp.locator('[data-burger]').click();
    await mp.waitForTimeout(600);
    await mp.screenshot({ path: path.join(out, `mobile-menu-scrolled-${tag}.jpg`), type: 'jpeg', quality: 80 });
    await mp.locator('[data-burger]').click();
    await mp.waitForTimeout(300);
  }
  await hideFixed(mp);
  await shotSection(mp, '#cases', `mobile-${lang}-cases`);
  await shotSection(mp, '.partners', `mobile-${lang}-partners`);
  await shotSection(mp, '#contacts', `mobile-${lang}-contacts`);
  await m.close();

  // десктоп
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const dp = await d.newPage();
  await dp.goto(`${base}${p}?v=${Date.now()}`, { waitUntil: 'networkidle' });
  await dp.evaluate(() => document.fonts.ready);
  await hideFixed(dp);
  await shotSection(dp, '.partners', `desktop-${lang}-partners`);
  await shotSection(dp, '#contacts', `desktop-${lang}-contacts`);
  await d.close();
}
await browser.close();
console.log(`готово: ${out} (${tag})`);
