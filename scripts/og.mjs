// OG-картинки 1200×630 (RU/EN) и фавиконы. Запускается перед сборкой (npm run build).
// Текст и цифры — из content/mediakit.json; портрет — src/assets/photos/about-cutout.png (или avatar.jpg).
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const r = (...p) => path.join(ROOT, ...p);
const kit = JSON.parse(fs.readFileSync(r('content/mediakit.json'), 'utf8'));
const font = (pkg, file) => fs.readFileSync(r('node_modules/@fontsource', pkg, 'files', file));

const fonts = [
  { name: 'Oswald', data: font('oswald', 'oswald-latin-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'OswaldC', data: font('oswald', 'oswald-cyrillic-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Unbounded', data: font('unbounded', 'unbounded-latin-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'UnboundedC', data: font('unbounded', 'unbounded-cyrillic-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'Manrope', data: font('manrope', 'manrope-latin-600-normal.woff'), weight: 600, style: 'normal' },
  { name: 'ManropeC', data: font('manrope', 'manrope-cyrillic-600-normal.woff'), weight: 600, style: 'normal' },
];

const h = (type, style, ...children) => {
  const list = children.flat().filter((c) => c !== null && c !== false && c !== undefined);
  // у satori элемент с несколькими детьми обязан быть flex
  const st = list.length > 1 && !style.display ? { display: 'flex', ...style } : style;
  return { type, props: { style: st, children: list.length === 1 ? list[0] : list } };
};
const img = (src, style) => ({ type: 'img', props: { src, style } });

async function portraitDataUri() {
  const cut = r('src/assets/photos/about-cutout.png');
  const ava = r('src/assets/photos/avatar.jpg');
  const src = fs.existsSync(cut) ? cut : fs.existsSync(ava) ? ava : null;
  if (!src) return null;
  const buf = await sharp(src).resize(760, 760, { fit: 'cover' }).png().toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const nf = (l) => new Intl.NumberFormat(l === 'ru' ? 'ru-RU' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 });
const CH = kit.channels.filter((c) => !c.minor);

async function og(l, portrait) {
  const followersLabel = kit.totals.followersAllPlatformsLabel?.[l] ?? '';
  const unit = l === 'ru' ? 'подписчиков' : 'followers';
  const name = kit.profile.fullName[l];
  const chans = CH.map((c) => `${c.platform === 'youtube' ? 'YouTube' : c.platform === 'tiktok' ? 'TikTok' : 'Instagram'} ${nf(l).format(c.stats.followers ?? c.stats.subscribers ?? 0)}`).join('  ·  ');

  const tree = h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      position: 'relative',
      backgroundColor: '#07080b',
      backgroundImage:
        'radial-gradient(circle at 78% 30%, rgba(238,241,245,0.55) 0%, rgba(170,179,194,0.30) 22%, rgba(58,68,83,0.25) 45%, rgba(7,8,11,0) 70%), linear-gradient(160deg, #1c212a 0%, #0b0d12 50%, #07080b 100%)',
      color: '#f3f4f7',
      fontFamily: 'Manrope, ManropeC',
      overflow: 'hidden',
    },
    portrait && img(portrait, { position: 'absolute', right: -20, bottom: -60, width: 690, height: 690 }),
    h('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 1200,
      height: 630,
      backgroundImage: 'linear-gradient(90deg, rgba(7,8,11,0.96) 0%, rgba(7,8,11,0.75) 38%, rgba(7,8,11,0) 62%)',
      display: 'flex',
    }),
    h(
      'div',
      { position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px', width: 760, height: 630 },
      h(
        'div',
        { display: 'flex', flexDirection: 'column' },
        h('div', { fontFamily: 'Unbounded, UnboundedC', fontSize: 22, letterSpacing: 1, color: '#9aa3b2', textTransform: 'uppercase' }, kit.profile.tagline),
        h(
          'div',
          { display: 'flex', alignItems: 'flex-end', marginTop: 18 },
          h('div', { fontFamily: 'Oswald, OswaldC', fontSize: 230, lineHeight: 0.8, letterSpacing: -2 }, kit.profile.displayName),
          h('div', { fontFamily: 'Unbounded, UnboundedC', fontSize: 34, marginLeft: 26, marginBottom: 14, textTransform: 'uppercase' }, 'Media Kit'),
        ),
        h('div', { fontFamily: 'Manrope, ManropeC', fontSize: 30, marginTop: 26, color: '#d5d9e1' }, name),
      ),
      h(
        'div',
        { display: 'flex', flexDirection: 'column' },
        h(
          'div',
          { display: 'flex', alignItems: 'baseline' },
          h('div', { fontFamily: 'Oswald, OswaldC', fontSize: 112, color: '#f1b5c4', lineHeight: 0.9 }, followersLabel),
          h('div', { fontFamily: 'Manrope, ManropeC', fontSize: 32, marginLeft: 18, color: '#f3f4f7' }, unit),
        ),
        h('div', { fontFamily: 'Manrope, ManropeC', fontSize: 19, marginTop: 16, color: '#9aa3b2', whiteSpace: 'nowrap' }, chans),
      ),
    ),
  );
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  fs.writeFileSync(r('public', `og-${l}.png`), await sharp(png).png({ compressionLevel: 9, palette: false }).toBuffer());
}

async function favicon() {
  const tree = h(
    'div',
    {
      width: 64,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#07080b',
      backgroundImage: 'linear-gradient(180deg, #1c212a 0%, #07080b 100%)',
      borderRadius: 14,
      color: '#f3f4f7',
    },
    h('div', { fontFamily: 'Oswald, OswaldC', fontSize: 52, lineHeight: 1, marginTop: -2 }, 'M'),
  );
  const svg = await satori(tree, { width: 64, height: 64, fonts });
  fs.writeFileSync(r('public', 'favicon.svg'), svg);
  const render = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(r('public', 'favicon-32.png'), render(32));
  // apple-touch-icon — без скругления (iOS скругляет сам)
  const appleTree = { ...tree, props: { ...tree.props, style: { ...tree.props.style, borderRadius: 0 } } };
  const appleSvg = await satori(appleTree, { width: 64, height: 64, fonts });
  fs.writeFileSync(r('public', 'apple-touch-icon.png'), new Resvg(appleSvg, { fitTo: { mode: 'width', value: 180 } }).render().asPng());
}

const portrait = await portraitDataUri();
await og('ru', portrait);
await og('en', portrait);
await favicon();
console.log('og: public/og-ru.png, og-en.png, favicon.svg, favicon-32.png, apple-touch-icon.png');
