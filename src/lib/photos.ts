// Фото Мира и рисунки. Приоритет (§6.2): assets/photos/ от заказчика → отобранные кадры в src/assets/photos/.
import type { ImageMetadata } from 'astro';

type Mods = Record<string, ImageMetadata>;
const client = import.meta.glob<ImageMetadata>('../../assets/photos/*.{jpg,jpeg,png,webp,avif}', { eager: true, import: 'default' });
const picked = import.meta.glob<ImageMetadata>('../assets/photos/*.{jpg,jpeg,png,webp,avif}', { eager: true, import: 'default' });
const screensClient = import.meta.glob<ImageMetadata>('../../assets/screens/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });
const artClient = import.meta.glob<ImageMetadata>('../../assets/art/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });
const artPicked = import.meta.glob<ImageMetadata>('../assets/art/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });

const byName = (mods: Mods) =>
  Object.fromEntries(Object.entries(mods).map(([k, v]) => [k.split('/').pop()!.replace(/\.[^.]+$/, ''), v]));

const clientPhotos = byName(client);
const pickedPhotos = byName(picked);

/** фото по имени (без расширения): сначала от заказчика, потом отобранное */
export function photo(name: string): ImageMetadata | undefined {
  return clientPhotos[name] ?? pickedPhotos[name];
}

/** скриншот профиля от заказчика: instagram / tiktok-rinkiwi / tiktok-miirakhh */
export function screen(name: string): ImageMetadata | undefined {
  return byName(screensClient)[name];
}

/** рисунки для арт-слоя и сетки арт-телефона */
export function art(prefix = ''): ImageMetadata[] {
  const all = { ...byName(artPicked), ...byName(artClient) };
  return Object.entries(all)
    .filter(([k]) => k.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}
