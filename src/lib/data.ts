// Загрузка content/mediakit.json + content/media-manifest.json, типы и хелперы.
// Серверный модуль (использует node:fs) — в клиентский бандл не попадает.
import fs from 'node:fs';
import path from 'node:path';
import raw from '../../content/mediakit.json';
import { countCompact, countInt, fmtCompact, fmtMonth, type Locale } from './format';
import type { Dict } from '../i18n/ru';

export type { Locale };
export const LOCALES: Locale[] = ['ru', 'en'];

// ---------------------------------------------------------------- типы JSON
export interface L10n {
  ru: string;
  en: string;
}
export interface L10nList {
  ru: string[];
  en: string[];
}
export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'telegram';

export interface SourceStats {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
}
export interface Source {
  platform: Platform;
  role?: string;
  id: string;
  url: string;
  account?: string;
  date?: string | null;
  stats?: SourceStats | null;
  durationSec?: number | null;
  embed?: string;
  thumb?: string;
  title?: string;
  caption?: string;
  shortUrl?: string;
  note?: string;
  availability?: string;
}
export interface CaseTotals {
  videos?: number;
  knownViews?: number | null;
  bestViews?: number | null;
}
export interface Case {
  slug: string;
  brand: string;
  handle?: string;
  brandUrl?: string;
  category: string;
  featured?: boolean;
  summary?: L10n;
  sources: Source[];
  showInCases?: boolean;
  coBrands?: string[];
  logo?: string;
  totals?: CaseTotals;
}
export interface TopItem {
  slug: string;
  kind?: string;
  title: L10n;
  sources: Source[];
  stills?: boolean;
}
export interface Channel {
  id: string;
  platform: Platform;
  handle: string;
  url: string;
  role: L10n;
  stats: Record<string, number | null | undefined>;
  note?: string;
  primary?: boolean;
  minor?: boolean;
}
export interface Share {
  name: string;
  share: number;
}
export interface AudienceBlock {
  gender?: Record<string, number> | null;
  age?: Record<string, number> | null;
  countries?: Share[] | null;
  cities?: Share[] | null;
  reach30d?: number | null;
  avgReelViews?: number | null;
  storyViews?: number | null;
}
export interface Format {
  id: string;
  title: L10n;
  items: L10nList;
  price: number | string | null;
  needsConfirmation?: boolean;
  confirmed?: boolean;
}
export interface MediaKit {
  meta: { collectedAt: string; locales: Locale[]; defaultLocale: Locale };
  profile: {
    displayName: string;
    fullName: L10n;
    aliases: string[];
    age?: number | null;
    origin: L10n;
    cities: L10nList;
    flags: string[];
    roles: L10nList;
    tagline: string;
    bioShort: L10n;
    bioLong: L10n;
  };
  channels: Channel[];
  totals: {
    followersAllPlatforms: number;
    followersAllPlatformsLabel?: L10n;
    tiktokLikes: number;
    youtubeShortsViews: number;
    brandsCount: number;
    integrationVideosKnown: number;
    integrationViewsKnown: number;
  };
  contentPillars: { id: string; title: L10n; text: L10n }[];
  whyMe: L10n[];
  categories: { id: string; label: L10n }[];
  cases: Case[];
  topContent: TopItem[];
  extraIntegrations?: (Case & { include?: boolean })[];
  audience: {
    status?: string;
    instagram?: AudienceBlock | null;
    tiktok?: AudienceBlock | null;
    youtube?: AudienceBlock | null;
  };
  formats: Format[];
  ambassadorship: {
    title: L10n;
    items: L10nList;
    priceOld: number | string | null;
    price: number | string | null;
    proof?: L10n;
  };
  restrictions: { status?: string; items: (L10n | string)[] };
  pricing: { currency: string | null };
  contacts: {
    primaryCta: { label: L10n; url: string };
    telegramAds: { handle: string; url: string; label: L10n };
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    socials: string[];
  };
}

export const kit = raw as unknown as MediaKit;

// ---------------------------------------------------------------- манифест медиа
export interface ManifestItem {
  kind?: string;
  video?: string;
  preview?: string;
  poster?: string;
  durationSec?: number | null;
  source?: { platform: Platform; id: string; url: string };
  stills?: string[];
  errors?: string[];
}
export interface Manifest {
  items: Record<string, ManifestItem>;
  thumbs: Record<string, string>;
  updatedAt?: string;
}

const manifestMods = import.meta.glob<Manifest>('../../content/media-manifest.json', { eager: true, import: 'default' });
const manifestRaw: Partial<Manifest> = Object.values(manifestMods)[0] ?? {};
export const manifest: Manifest = {
  ...manifestRaw,
  items: manifestRaw.items ?? {},
  thumbs: manifestRaw.thumbs ?? {},
};

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const existsCache = new Map<string, boolean>();
/** файл из public/ реально есть (манифест мог устареть) */
export function publicExists(p: string | undefined | null): p is string {
  if (!p) return false;
  let ok = existsCache.get(p);
  if (ok === undefined) {
    ok = fs.existsSync(path.join(PUBLIC_DIR, p.replace(/^\//, '')));
    existsCache.set(p, ok);
  }
  return ok;
}

/** путь с учётом base (GitHub Pages живёт в подпапке) */
export function withBase(p: string): string {
  if (/^https?:\/\//.test(p)) return p;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

// ---------------------------------------------------------------- локализация
export const tr = (v: L10n | undefined | null, l: Locale): string => (v ? (v[l] ?? v.ru ?? '') : '');
export const trList = (v: L10nList | undefined | null, l: Locale): string[] => (v ? (v[l] ?? v.ru ?? []) : []);
export const localePrefix = (l: Locale): string => (l === kit.meta.defaultLocale ? '' : `/${l}`);

// ---------------------------------------------------------------- постеры
export interface PosterRef {
  src: string;
  srcset?: string;
  remote?: boolean;
}

/** `/media/cases/fata.webp` → { src, srcset с вариантом .w360 (готовит scripts/posters.mjs) } */
function localPoster(p: string): PosterRef {
  const small = p.replace(/\.webp$/, '.w360.webp');
  const ref: PosterRef = { src: withBase(p) };
  if (publicExists(small)) ref.srcset = `${withBase(small)} 360w, ${withBase(p)} 720w`;
  return ref;
}

/** §6.4: manifest.poster → обложка YouTube-источника из manifest.thumbs → sources[].thumb → null (сгенерированная карточка) */
export function pickPoster(slug: string, sources: Source[]): PosterRef | null {
  const m = manifest.items[slug];
  if (publicExists(m?.poster)) return localPoster(m.poster);
  const yt = sources.filter((s) => s.platform === 'youtube').sort((a, b) => (b.stats?.views ?? 0) - (a.stats?.views ?? 0));
  for (const s of yt) {
    const t = manifest.thumbs[s.id];
    if (publicExists(t)) return localPoster(t);
  }
  for (const s of sources) if (s.thumb) return { src: s.thumb, remote: true };
  return null;
}

/** маленькая версия постера (плитки в телефонах) */
export function posterSmall(ref: PosterRef | null): string | null {
  if (!ref) return null;
  if (ref.srcset) return ref.srcset.split(',')[0].trim().split(' ')[0];
  return ref.src;
}

// ---------------------------------------------------------------- плеер
export type PlayerSpec =
  | { kind: 'video'; src: string; poster?: string }
  | { kind: 'iframe'; src: string; platform: Platform }
  | { kind: 'link'; url: string; platform: Platform };

function embedFor(s: Source): PlayerSpec {
  switch (s.platform) {
    case 'youtube':
      return {
        kind: 'iframe',
        platform: 'youtube',
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(s.id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
      };
    case 'tiktok':
      return {
        kind: 'iframe',
        platform: 'tiktok',
        src: `https://www.tiktok.com/player/v1/${encodeURIComponent(s.id)}?autoplay=1&rel=0&description=1&music_info=0`,
      };
    case 'instagram':
      return { kind: 'iframe', platform: 'instagram', src: `https://www.instagram.com/reel/${encodeURIComponent(s.id)}/embed/` };
    default:
      return { kind: 'link', platform: s.platform, url: s.url };
  }
}

/** плеер для конкретного источника: локальный mp4, если скачан именно он, иначе embed */
export function playerFor(slug: string, s: Source, poster?: string): PlayerSpec {
  const m = manifest.items[slug];
  if (m?.source?.id === s.id && publicExists(m.video)) return { kind: 'video', src: withBase(m.video), poster };
  return embedFor(s);
}

/** §6.5: с какого ролика открывать: локальный mp4 → YouTube → TikTok → Instagram (внутри — по просмотрам) */
export function startSource(slug: string, sources: Source[]): Source | null {
  if (!sources.length) return null;
  const m = manifest.items[slug];
  if (m?.source && publicExists(m.video)) {
    const local = sources.find((s) => s.id === m.source!.id);
    if (local) return local;
  }
  const prio: Record<string, number> = { youtube: 0, tiktok: 1, instagram: 2 };
  const ok = sources.filter((s) => s.availability !== 'region_blocked_from_KZ');
  const pool = ok.length ? ok : sources;
  return [...pool].sort(
    (a, b) => (prio[a.platform] ?? 9) - (prio[b.platform] ?? 9) || (b.stats?.views ?? 0) - (a.stats?.views ?? 0),
  )[0];
}

export function previewFor(slug: string): string | null {
  const p = manifest.items[slug]?.preview;
  return publicExists(p) ? withBase(p) : null;
}

// ---------------------------------------------------------------- кейсы
/** extraIntegrations с include: true (заказчик подтвердил) превращаются в обычные кейсы */
function includedExtras(): Case[] {
  return (kit.extraIntegrations ?? [])
    .filter((e) => e.include === true && (e.sources?.length ?? 0) > 0)
    .map((e) => {
      const views = e.sources.map((s) => s.stats?.views).filter((v): v is number => typeof v === 'number');
      return {
        ...e,
        featured: false,
        showInCases: true,
        brandUrl: e.brandUrl ?? (e.handle ? `https://www.instagram.com/${e.handle}/` : undefined),
        totals: e.totals ?? {
          videos: e.sources.length,
          knownViews: views.length ? views.reduce((a, b) => a + b, 0) : null,
          bestViews: views.length ? Math.max(...views) : null,
        },
      };
    });
}

export function allCases(): Case[] {
  return [...kit.cases, ...includedExtras()];
}

export function visibleCases(): Case[] {
  const list = allCases().filter((c) => c.showInCases !== false && (c.sources?.length ?? 0) > 0);
  return list.sort((a, b) => {
    const f = Number(!!b.featured) - Number(!!a.featured);
    if (f) return f;
    const av = a.totals?.knownViews ?? -1;
    const bv = b.totals?.knownViews ?? -1;
    return bv - av;
  });
}

/** все бренды для «Партнёров», включая кейсы без ролика (Sodamoda) */
export function partnerBrands(): Case[] {
  return allCases().filter((c) => c.brand);
}

export function categoriesWithCases(cases: Case[]) {
  const used = new Set(cases.map((c) => c.category));
  return kit.categories.filter((c) => used.has(c.id));
}

export function categoryLabel(id: string, l: Locale): string {
  return tr(kit.categories.find((c) => c.id === id)?.label, l);
}

/** бейдж карточки: лучшие просмотры → лайки/комментарии IG → ничего */
export function caseBadge(c: Case, l: Locale, t: Dict): string | null {
  const best = c.totals?.bestViews;
  if (best) return countCompact(best, l, t.units.views);
  const withEng = c.sources.find((s) => s.stats?.likes || s.stats?.comments);
  if (withEng?.stats) {
    const parts: string[] = [];
    if (withEng.stats.likes) parts.push(countInt(withEng.stats.likes, l, t.units.likes));
    if (withEng.stats.comments) parts.push(countInt(withEng.stats.comments, l, t.units.comments));
    return parts.join(' · ');
  }
  return null;
}

export function casePlatforms(c: { sources: Source[] }): Platform[] {
  const order: Platform[] = ['instagram', 'tiktok', 'youtube'];
  const set = new Set(c.sources.map((s) => s.platform));
  return order.filter((p) => set.has(p));
}

// ---------------------------------------------------------------- данные для модалки (сериализуются в JSON на странице)
export interface ClientVideo {
  platform: Platform;
  url: string;
  date: string | null;
  stats: SourceStats;
  player: PlayerSpec;
  blocked?: boolean;
  title?: string;
}
export interface ClientItem {
  id: string;
  type: 'case' | 'top';
  title: string;
  brandUrl?: string;
  handle?: string;
  category?: string;
  summary?: string;
  totals?: string;
  poster?: string;
  videos: ClientVideo[];
}

function sortForModal(slug: string, sources: Source[]): Source[] {
  const first = startSource(slug, sources);
  const rest = sources
    .filter((s) => s !== first)
    .sort((a, b) => (b.stats?.views ?? -1) - (a.stats?.views ?? -1));
  return first ? [first, ...rest] : rest;
}

function clientVideos(slug: string, sources: Source[], poster: string | undefined): ClientVideo[] {
  return sortForModal(slug, sources).map((s) => ({
    platform: s.platform,
    url: s.url,
    date: s.date ?? null,
    stats: s.stats ?? {},
    player: playerFor(slug, s, poster),
    blocked: s.availability === 'region_blocked_from_KZ' || undefined,
    title: s.title || s.caption || undefined,
  }));
}

export function clientCase(c: Case, l: Locale, t: Dict): ClientItem {
  const poster = pickPoster(c.slug, c.sources);
  const total = c.totals?.videos ?? c.sources.length;
  const parts = [countInt(total, l, t.units.videos)];
  if (c.totals?.knownViews) parts.push(countCompact(c.totals.knownViews, l, t.units.views));
  return {
    id: c.slug,
    type: 'case',
    title: c.brand,
    brandUrl: c.brandUrl,
    handle: c.handle,
    category: categoryLabel(c.category, l),
    summary: tr(c.summary, l),
    totals: parts.join(' · '),
    poster: poster?.src,
    videos: clientVideos(c.slug, c.sources, poster?.src),
  };
}

export function clientTop(item: TopItem, l: Locale): ClientItem {
  const poster = pickPoster(item.slug, item.sources);
  return {
    id: item.slug,
    type: 'top',
    title: tr(item.title, l),
    poster: poster?.src,
    videos: clientVideos(item.slug, item.sources, poster?.src),
  };
}

// ---------------------------------------------------------------- прочее
export function channel(id: string): Channel | undefined {
  return kit.channels.find((c) => c.id === id);
}

export function hasAudience(): boolean {
  const a = kit.audience;
  return !!(a && (a.instagram || a.tiktok || a.youtube));
}

export function hasAnyPrice(): boolean {
  return kit.formats.some((f) => f.price != null && f.price !== '') || kit.ambassadorship.price != null;
}

export function fmtPrice(v: number | string | null | undefined, l: Locale): string | null {
  if (v == null || v === '') return null;
  const cur = kit.pricing.currency;
  const num = typeof v === 'number' ? new Intl.NumberFormat(l === 'ru' ? 'ru-RU' : 'en-US').format(v) : v;
  return cur ? `${num} ${cur}` : num;
}

export function visibleFormats(): Format[] {
  return kit.formats.filter((f) => !f.needsConfirmation || f.confirmed);
}

export const monthOf = fmtMonth;
export { fmtCompact };
