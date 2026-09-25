# MIR — медиакит блогера

Одностраничный сайт-медиакит **Mir / Мирахмада Миркобилжонова** (@miirakhmad · TikTok @rinkiwi / @miirakhh · YouTube @miirakh). Русская версия — `/`, английская — `/en/`.

Стек: Astro 7 (static), TypeScript, обычный CSS с токенами, шрифты Oswald / Unbounded / Manrope через `@fontsource` (с кириллицей). Интерактив — маленькие скрипты на ванильном TS, без UI-фреймворков и библиотек анимации.

## Быстрый старт

Нужен Node 22.12+.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # постеры → OG-картинки → astro check → dist/
npm run preview    # посмотреть собранный dist/
```

## Откуда берутся данные

| Что | Где |
|---|---|
| Все цифры, тексты, кейсы, форматы, контакты | `content/mediakit.json` — единственный источник |
| Что скачалось из видео | `content/media-manifest.json` (пишет `scripts/fetch_media.py`) |
| Ролики, превью, постеры | `public/media/cases/`, обложки YouTube — `public/media/thumbs/` |
| Фото Мира | `src/assets/photos/` (отобранные кадры) · `assets/photos/` (фото от заказчика, главнее) |
| Рисунки Мира | `src/assets/art/` · `assets/art/` |
| UI-строки RU/EN | `src/i18n/ru.ts`, `src/i18n/en.ts` |

Как обновить сайт без правки кода:
- **Статистика аудитории** — заполнить `audience.instagram` / `audience.tiktok` в JSON (формат — `audience.schemaExample`); вместо плашки «по запросу» появятся карточки с полосками.
- **Цены** — `formats[].price`, `ambassadorship.price` / `priceOld`, `pricing.currency`; заголовок сменится на «Прайс».
- **Формат «мероприятия»** — добавить `"confirmed": true` к формату с `needsConfirmation`.
- **Доп. интеграции** (SKIN1004, GESKE…) — `extraIntegrations[].include = true`, затем `npm run media` (скачает ролики).
- **«Не рекламирую»** — заполнить `restrictions.items` и сменить `status`.
- **Телефон / WhatsApp** — `contacts.phone` / `contacts.whatsapp`.
- **Логотипы брендов** — положить `assets/logos/<slug>.svg|png`; если логотипы есть у ≥ 70% брендов, вордмарки заменятся картинками.
- **Скриншоты профилей** — `assets/screens/instagram.png`, `assets/screens/tiktok-rinkiwi.png` встанут в телефоны на обложке.

## Медиа

```bash
python -m pip install -U -r scripts/requirements.txt   # + ffmpeg в PATH
python scripts/fetch_media.py --dry-run
python scripts/fetch_media.py                           # идемпотентно: докачивает только недостающее
npm run posters                                         # уменьшенные постеры для карточек (входит в build)
```

Для роликов Instagram, которые без входа не отдаются: `--cookies-from-browser firefox` или `--cookies secrets/cookies.txt` (папка `secrets/` в `.gitignore`).

## Проверки

```bash
npm run preview                                   # в другом окне
node scripts/shots.mjs http://localhost:4321 --full   # скриншоты 375 и 1440, RU/EN + горизонтальный скролл, битые картинки, ошибки консоли
node scripts/test-interact.mjs http://localhost:4321  # фильтры, модалка, видео, стрелки, Esc, свайп, превью, языки
node scripts/lighthouse.mjs http://localhost:4321 ru mobile
```

## Деплой

**Vercel** (основной вариант): New Project → импортировать репозиторий → Framework preset «Astro» (Build `npm run build`, Output `dist`). Переменные окружения не нужны; для своего домена можно задать `MIR_SITE=https://домен` — от него строятся canonical, hreflang и адреса OG-картинок.

**Netlify**: Build command `npm run build`, Publish directory `dist`.

**GitHub Pages** (превью): workflow `.github/workflows/pages.yml` собирает сайт с `MIR_BASE=/<репозиторий>/` и публикует на `https://<логин>.github.io/<репозиторий>/`.

Отчёт о сборке, медиа и том, что ещё нужно от заказчика, — в `REPORT.md`. ТЗ — `TZ.md`, чек-лист для заказчика — `CHECKLIST.md`.
