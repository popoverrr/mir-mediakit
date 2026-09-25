// Форматирование чисел и дат — общее для сборки (Astro) и клиента (модалка, счётчики).
// Никаких импортов из node: файл попадает в клиентский бандл.

export type Locale = 'ru' | 'en';

export const intlLocale = (l: Locale): string => (l === 'ru' ? 'ru-RU' : 'en-US');

const cache = new Map<string, Intl.NumberFormat>();
function nf(l: Locale, key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `${l}|${key}`;
  let f = cache.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat(intlLocale(l), opts);
    } catch {
      // старые движки не знают roundingPriority — откат на простое округление
      const { roundingPriority: _rp, maximumSignificantDigits: _ms, ...rest } = opts as Intl.NumberFormatOptions & {
        roundingPriority?: string;
      };
      f = new Intl.NumberFormat(intlLocale(l), rest);
    }
    cache.set(k, f);
  }
  return f;
}

/** «2,5 млн», «727 тыс.», «41,1 тыс.» / «2.5M», «727K» */
export function fmtCompact(n: number, l: Locale): string {
  return nf(l, 'compact', {
    notation: 'compact',
    maximumFractionDigits: 1,
    maximumSignificantDigits: 3,
    roundingPriority: 'lessPrecision',
  } as Intl.NumberFormatOptions).format(n);
}

/** Округление вниз до двух значащих цифр + «+»: 2 093 100 → «2 млн+», 25 535 100 → «25 млн+» */
export function floorSignificant(n: number, digits = 2): number {
  if (n <= 0) return 0;
  const p = 10 ** (Math.floor(Math.log10(n)) - (digits - 1));
  return Math.floor(n / p) * p;
}

export function fmtPlus(n: number, l: Locale): string {
  return `${fmtCompact(floorSignificant(n), l)}+`;
}

/** «2 171» / «2,171» */
export function fmtInt(n: number, l: Locale): string {
  return nf(l, 'int', { maximumFractionDigits: 0 }).format(n);
}

export interface PluralForms {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

const prCache = new Map<Locale, Intl.PluralRules>();
export function plural(n: number, l: Locale, forms: PluralForms): string {
  let pr = prCache.get(l);
  if (!pr) {
    pr = new Intl.PluralRules(intlLocale(l));
    prCache.set(l, pr);
  }
  const cat = pr.select(n) as keyof PluralForms;
  return forms[cat] ?? forms.other;
}

/** Подпись к компактному числу: после «тыс./млн» в русском всегда родительный множественного */
export function unitFor(n: number, l: Locale, forms: PluralForms, compact: boolean): string {
  if (compact && n >= 1000) return l === 'ru' ? (forms.many ?? forms.other) : forms.other;
  return plural(n, l, forms);
}

/** «2,5 млн просмотров» */
export function countCompact(n: number, l: Locale, forms: PluralForms): string {
  const compact = n >= 10000;
  const num = compact ? fmtCompact(n, l) : fmtInt(n, l);
  return `${num} ${unitFor(n, l, forms, compact)}`;
}

/** «2 171 лайк» */
export function countInt(n: number, l: Locale, forms: PluralForms): string {
  return `${fmtInt(n, l)} ${plural(n, l, forms)}`;
}

function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? '1')));
}

/** «февраль 2026» / «February 2026» */
export function fmtMonth(iso: string | null | undefined, l: Locale): string | null {
  if (!iso) return null;
  const d = parseDate(iso);
  if (!d) return null;
  if (l === 'ru') {
    const s = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(d);
    return `${s} ${d.getUTCFullYear()}`;
  }
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** «25 сентября 2026» / «September 25, 2026» */
export function fmtDay(iso: string | null | undefined, l: Locale): string | null {
  if (!iso) return null;
  const d = parseDate(iso);
  if (!d) return null;
  return new Intl.DateTimeFormat(intlLocale(l), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(d)
    .replace(/\s?г\.$/, '');
}
