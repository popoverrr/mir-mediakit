// Скриншоты и быстрые проверки через Playwright (Chromium).
//   node scripts/shots.mjs [baseUrl] [--out docs/screens] [--only desktop|mobile] [--full]
// Проверяет: горизонтальный скролл, ошибки консоли, битые картинки; снимает первый экран и всю страницу
// (для полной страницы включается prefers-reduced-motion — все блоки сразу видны).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? 'http://127.0.0.1:4351').replace(/\/$/, '');
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'docs/screens';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const full = args.includes('--full');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'mobile', width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
].filter((v) => !only || v.name === only);
const pages = [
  { lang: 'ru', path: '/' },
  { lang: 'en', path: '/en/' },
];

const browser = await chromium.launch();
const problems = [];
for (const vp of viewports) {
  for (const pg of pages) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + pg.path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const tag = `${vp.name}-${pg.lang}`;
    await page.screenshot({ path: path.join(outDir, `${tag}-first.png`) });

    // прокрутка для lazy-картинок
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const report = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [];
      if (de.scrollWidth > window.innerWidth + 1) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
            // пропускаем то, что внутри горизонтальных лент со своим скроллом
            let p = el.parentElement;
            let clipped = false;
            while (p) {
              const cs = getComputedStyle(p);
              if (['auto', 'scroll', 'hidden', 'clip'].includes(cs.overflowX)) {
                clipped = true;
                break;
              }
              p = p.parentElement;
            }
            if (!clipped) wide.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(r.right)}`);
          }
        }
      }
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.currentSrc || i.src);
      return { scrollWidth: de.scrollWidth, innerWidth: window.innerWidth, wide: wide.slice(0, 12), broken, height: de.scrollHeight };
    });
    if (report.scrollWidth > report.innerWidth + 1) problems.push(`${tag}: горизонтальный скролл ${report.scrollWidth} > ${report.innerWidth}: ${report.wide.join('; ')}`);
    if (report.broken.length) problems.push(`${tag}: битые картинки: ${report.broken.join(', ')}`);
    if (errors.length) problems.push(`${tag}: ошибки консоли: ${errors.join(' | ')}`);
    if (full) await page.screenshot({ path: path.join(outDir, `${tag}-full.png`), fullPage: true });
    console.log(`${tag}: высота ${report.height}px, ширина ${report.scrollWidth}/${report.innerWidth}`);
    await ctx.close();
  }
}
await browser.close();
if (problems.length) {
  console.log('\nПроблемы:\n- ' + problems.join('\n- '));
  process.exitCode = 1;
} else console.log('\nПроблем не найдено');
