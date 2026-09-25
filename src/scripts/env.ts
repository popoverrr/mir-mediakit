// Общие флаги окружения для клиентских скриптов.
export const reduceMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canHover = (): boolean => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const saveData = (): boolean =>
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
export const locale = (): 'ru' | 'en' => (document.documentElement.dataset.locale === 'en' ? 'en' : 'ru');
