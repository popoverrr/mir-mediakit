// Уменьшенные версии постеров (…/name.w360.webp) рядом с исходниками из fetch_media.py.
// Карточки и плитки телефонов грузят их через srcset — первая загрузка остаётся лёгкой.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIRS = ['public/media/cases', 'public/media/thumbs'].map((d) => path.join(ROOT, d));

let made = 0;
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.webp') || f.includes('.w360.')) continue;
    const src = path.join(dir, f);
    const dst = path.join(dir, f.replace(/\.webp$/, '.w360.webp'));
    if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    await sharp(src).resize({ width: 360, withoutEnlargement: true }).webp({ quality: 70 }).toFile(dst);
    made++;
  }
}
console.log(`posters: ${made} новых превью`);
