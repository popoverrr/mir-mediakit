// Lighthouse через Playwright-Chromium.
//   node scripts/lighthouse.mjs [base] [ru|en] [mobile|desktop]
// Результат: docs/lighthouse/<lang>-<form>.json и краткий вывод (оценки, метрики, вес страницы).
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:4351').replace(/\/$/, '');
const lang = process.argv[3] === 'en' ? 'en' : 'ru';
const mobile = process.argv[4] !== 'desktop';
const port = 9335;
const browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`] });
try {
  const url = `${base}${lang === 'en' ? '/en/' : '/'}`;
  const result = await lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: mobile ? 'mobile' : 'desktop',
    screenEmulation: mobile
      ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
      : { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    throttlingMethod: 'simulate',
    ...(mobile ? {} : { throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } }),
  });
  const lhr = result.lhr;
  fs.mkdirSync('docs/lighthouse', { recursive: true });
  const name = `${lang}-${mobile ? 'mobile' : 'desktop'}`;
  fs.writeFileSync(`docs/lighthouse/${name}.json`, JSON.stringify(lhr));
  const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
  const a = lhr.audits;
  const pick = (k) => a[k]?.displayValue ?? '—';
  console.log(name, JSON.stringify(scores));
  console.log('FCP', pick('first-contentful-paint'), '| LCP', pick('largest-contentful-paint'), '| CLS', pick('cumulative-layout-shift'), '| TBT', pick('total-blocking-time'), '| SI', pick('speed-index'));
  console.log('Вес:', pick('total-byte-weight'));
  const lcpNode = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet;
  console.log('LCP element:', (lcpNode || '').slice(0, 160));
  const fails = Object.values(a)
    .filter((x) => x.score !== null && x.score < 0.9 && ['binary', 'numeric', 'metricSavings'].includes(x.scoreDisplayMode))
    .map((x) => `${x.id}${x.displayValue ? ` (${x.displayValue})` : ''}`);
  console.log('Проблемные аудиты:', fails.join('; ') || 'нет');
} finally {
  await browser.close();
}
