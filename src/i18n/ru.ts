// Только UI-строки. Факты и цифры — из content/mediakit.json.
import type { PluralForms } from '../lib/format';

const P = (f: PluralForms): PluralForms => f;

const ru = {
  htmlLang: 'ru',
  seoTitle: 'MIR — медиакит блогера | Мирахмад Миркобилжонов',
  ogAlt: 'MIR · Media Kit — 2 млн+ подписчиков',
  skip: 'К содержанию',

  nav: {
    about: 'Обо мне',
    cases: 'Кейсы',
    stats: 'Статистика',
    formats: 'Форматы',
    contacts: 'Контакты',
    menu: 'Меню',
    close: 'Закрыть меню',
    langLabel: 'Язык',
    toOther: 'English version',
    mobileCta: 'Написать в Telegram',
  },

  hero: {
    mediaKit: 'Media Kit',
    seeCases: 'Смотреть кейсы',
    phoneIg: 'Профиль в Instagram',
    phoneTt: 'Арт-профиль в TikTok',
    posts: 'публикации',
    followers: 'подписчики',
    likes: 'лайки',
    videos: 'видео',
    follow: 'Подписаться',
    message: 'Сообщение',
  },

  numbers: {
    title: 'Цифры',
    followers: 'подписчиков',
    followersSrc: 'Instagram, два TikTok и YouTube',
    tiktokLikes: 'лайков в TikTok',
    shorts: 'просмотров Shorts',
    shortsSrc: (n: string) => `${n} шортсов на YouTube`,
    adViews: 'просмотров рекламы',
    adViewsSrc: 'TikTok и Shorts, без Instagram',
    brands: P({ one: 'бренд', few: 'бренда', many: 'брендов', other: 'бренда' }),
    brandsSrc: (n: string) => `${n} рекламных роликов`,
  },

  about: {
    title: 'Обо мне',
    pillars: 'Что я снимаю',
    facts: 'Коротко',
    age: (age: number) => `${age} ${age % 10 === 1 && age % 100 !== 11 ? 'год' : [2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100) ? 'года' : 'лет'}`,
    rinkiwi: 'Rinkiwi: рисунки с миллионами просмотров',
    why: 'Почему со мной работают',
    watchIntro: 'Смотреть знакомство',
    restrictions: 'Не рекламирую',
    portraitAlt: 'Мирахмад — портрет',
  },

  platforms: {
    title: 'Площадки',
    lead: 'У меня два TikTok: арт-аккаунт @{art} и лайфстайл @{life} — рекламные интеграции выходят во втором. Одна съёмка расходится по Instagram, TikTok и YouTube Shorts.',
    open: 'Открыть',
    formerly: 'Раньше — @{alias}',
    followers: P({ one: 'подписчик', few: 'подписчика', many: 'подписчиков', other: 'подписчика' }),
    likes: 'лайков',
    videos: 'видео',
    posts: 'публикаций',
    shortsViews: 'просмотров Shorts',
    tgChannel: 'Telegram-канал',
  },

  partners: {
    title: 'Партнёры',
    screenLabel: 'Бренды, с которыми я работал',
  },

  cases: {
    title: 'Кейсы',
    all: 'Все',
    filterLabel: 'Фильтр по категориям',
    featured: 'Главные кейсы',
    more: 'Ещё кейсы',
    igNote: 'Просмотры Instagram не учтены — без входа в аккаунт их не видно, поэтому реальные цифры выше.',
    open: 'Смотреть кейс',
    prev: 'Назад',
    next: 'Вперёд',
    empty: 'В этой категории пока нет кейсов.',
    subtitle: (brands: string, videos: string, views: string) => `${brands} · ${videos} · ${views} известных просмотров`,
  },

  units: {
    views: P({ one: 'просмотр', few: 'просмотра', many: 'просмотров', other: 'просмотра' }),
    likes: P({ one: 'лайк', few: 'лайка', many: 'лайков', other: 'лайка' }),
    comments: P({ one: 'комментарий', few: 'комментария', many: 'комментариев', other: 'комментария' }),
    videos: P({ one: 'ролик', few: 'ролика', many: 'роликов', other: 'ролика' }),
    brands: P({ one: 'бренд', few: 'бренда', many: 'брендов', other: 'бренда' }),
  },

  modal: {
    close: 'Закрыть',
    prev: 'Предыдущий',
    next: 'Следующий',
    campaign: 'Все ролики кампании',
    metrics: 'Метрики ролика',
    views: 'Просмотры',
    likes: 'Лайки',
    comments: 'Комментарии',
    shares: 'Репосты',
    saves: 'Сохранения',
    play: 'Смотреть здесь',
    original: 'Открыть оригинал',
    watchOn: 'Смотреть в {platform}',
    blocked: 'Недоступен в некоторых регионах',
    noStats: 'Статистика ролика не собрана',
    brand: 'Бренд',
    dialog: 'Просмотр ролика',
    playing: 'сейчас',
    loading: 'Загружаю плеер…',
  },

  top: {
    title: 'Вирусное',
    lead: (over1m: string) => `Органика без рекламы: ${over1m} шортсов больше миллиона просмотров. Такой охват получают и интеграции.`,
  },

  stats: {
    title: 'Статистика',
    shortsTitle: 'YouTube Shorts',
    shortsCount: 'шортсов',
    shortsViews: 'просмотров всего',
    shortsMedian: 'медиана просмотров',
    shortsOver1M: 'роликов больше 1 млн',
    shortsOver500K: 'роликов больше 500 тыс.',
    requestTitle: 'Подробная статистика аудитории — по запросу',
    requestText: 'Пол, возраст, страны и города подписчиков — пришлю свежие скриншоты из Instagram и TikTok.',
    requestBtn: 'Запросить в Telegram',
    gender: 'Пол',
    female: 'Женщины',
    male: 'Мужчины',
    age: 'Возраст',
    countries: 'Страны',
    cities: 'Города',
    reach30d: 'Охват за 30 дней',
    avgReelViews: 'Средние просмотры Reels',
    storyViews: 'Просмотры сторис',
    followersBy: 'Подписчики по площадкам',
    likesBy: 'Лайки в TikTok',
  },

  formats: {
    title: 'Форматы',
    titlePrice: 'Прайс',
    onRequest: 'по запросу',
    ask: 'Узнать стоимость',
    photoAlt: 'Мирахмад в кадре',
  },

  longterm: {
    title: 'Долгосрочно',
    lead: 'Люблю долгое сотрудничество',
    ask: 'Обсудить амбассадорство',
  },

  contacts: {
    title: 'Всегда на связи',
    lead: 'Реклама, коллаборации и амбассадорство — напишите в Telegram или на почту.',
    telegram: 'Telegram для рекламы',
    email: 'Почта',
    phone: 'Телефон',
    whatsapp: 'WhatsApp',
    socials: 'Площадки',
    cta: 'Обсудить рекламу в Telegram',
  },

  footer: {
    updated: 'Данные обновлены',
  },

  platformName: {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube Shorts',
    telegram: 'Telegram',
  },
};

export default ru;
export type Dict = typeof ru;
