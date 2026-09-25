import type { Dict } from './ru';

const en: Dict = {
  htmlLang: 'en',
  seoTitle: 'MIR — blogger media kit | Mirakhmad Mirkobiljanov',
  ogAlt: 'MIR · Media Kit — 2M+ followers',
  skip: 'Skip to content',

  nav: {
    about: 'About',
    cases: 'Cases',
    stats: 'Statistics',
    formats: 'Formats',
    contacts: 'Contact',
    menu: 'Menu',
    close: 'Close menu',
    langLabel: 'Language',
    toOther: 'Русская версия',
    mobileCta: 'Message on Telegram',
  },

  hero: {
    mediaKit: 'Media Kit',
    seeCases: 'See the cases',
    phoneIg: 'Instagram profile',
    phoneTt: 'Art profile on TikTok',
    posts: 'posts',
    followers: 'followers',
    likes: 'likes',
    videos: 'videos',
    follow: 'Follow',
    message: 'Message',
  },

  numbers: {
    title: 'Numbers',
    followers: 'followers',
    followersSrc: 'Instagram, two TikToks and YouTube',
    tiktokLikes: 'TikTok likes',
    shorts: 'Shorts views',
    shortsSrc: (n: string) => `${n} Shorts on YouTube`,
    adViews: 'views on brand videos',
    adViewsSrc: 'TikTok and Shorts, Instagram not counted',
    brands: { one: 'brand', other: 'brands' },
    brandsSrc: (n: string) => `${n} sponsored videos`,
  },

  about: {
    title: 'About me',
    pillars: 'What I create',
    facts: 'In short',
    age: (age: number) => `${age} years old`,
    rinkiwi: 'Rinkiwi: drawings with millions of views',
    why: 'Why brands work with me',
    watchIntro: 'Watch the intro',
    restrictions: 'I don’t advertise',
    portraitAlt: 'Mirakhmad — portrait',
  },

  platforms: {
    title: 'Platforms',
    lead: 'I run two TikToks: the art account @{art} and the lifestyle account @{life} — brand integrations go to the second one. One shoot runs across Instagram, TikTok and YouTube Shorts.',
    open: 'Open',
    formerly: 'Formerly @{alias}',
    followers: { one: 'follower', other: 'followers' },
    likes: 'likes',
    videos: 'videos',
    posts: 'posts',
    shortsViews: 'Shorts views',
    tgChannel: 'Telegram channel',
  },

  partners: {
    title: 'Partners',
    screenLabel: 'Brands I have worked with',
  },

  cases: {
    title: 'Cases',
    all: 'All',
    filterLabel: 'Filter by category',
    featured: 'Key cases',
    more: 'More cases',
    igNote: 'Instagram views are not counted — they are hidden without logging in, so the real numbers are higher.',
    open: 'Watch the case',
    prev: 'Back',
    next: 'Forward',
    empty: 'No cases in this category yet.',
    subtitle: (brands: string, videos: string, views: string) => `${brands} · ${videos} · ${views} known views`,
  },

  units: {
    views: { one: 'view', other: 'views' },
    likes: { one: 'like', other: 'likes' },
    comments: { one: 'comment', other: 'comments' },
    videos: { one: 'video', other: 'videos' },
    brands: { one: 'brand', other: 'brands' },
  },

  modal: {
    close: 'Close',
    prev: 'Previous',
    next: 'Next',
    campaign: 'All campaign videos',
    metrics: 'Video metrics',
    views: 'Views',
    likes: 'Likes',
    comments: 'Comments',
    shares: 'Shares',
    saves: 'Saves',
    play: 'Play here',
    original: 'Open original',
    watchOn: 'Watch on {platform}',
    blocked: 'Unavailable in some regions',
    noStats: 'No stats collected for this video',
    brand: 'Brand',
    dialog: 'Video viewer',
    playing: 'now',
    loading: 'Loading the player…',
  },

  top: {
    title: 'Viral',
    lead: (over1m: string) => `Organic reach, no ads: ${over1m} Shorts with over a million views. Integrations reach the same numbers.`,
  },

  stats: {
    title: 'Statistics',
    shortsTitle: 'YouTube Shorts',
    shortsCount: 'Shorts',
    shortsViews: 'total views',
    shortsMedian: 'median views',
    shortsOver1M: 'videos over 1M',
    shortsOver500K: 'videos over 500K',
    requestTitle: 'Detailed audience statistics — on request',
    requestText: 'Gender, age, countries and cities of the audience — I’ll send fresh screenshots from Instagram and TikTok.',
    requestBtn: 'Request on Telegram',
    gender: 'Gender',
    female: 'Women',
    male: 'Men',
    age: 'Age',
    countries: 'Countries',
    cities: 'Cities',
    reach30d: '30-day reach',
    avgReelViews: 'Average Reels views',
    storyViews: 'Story views',
    followersBy: 'Followers by platform',
    likesBy: 'TikTok likes',
  },

  formats: {
    title: 'Formats',
    titlePrice: 'Pricing',
    onRequest: 'on request',
    ask: 'Ask for a quote',
    photoAlt: 'Mirakhmad on camera',
  },

  longterm: {
    title: 'Long-term',
    lead: 'I love long-term partnerships',
    ask: 'Discuss an ambassadorship',
  },

  contacts: {
    title: 'Always in touch',
    lead: 'Ads, collaborations and ambassadorships — message me on Telegram or by email.',
    telegram: 'Telegram for ads',
    email: 'Email',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    socials: 'Platforms',
    cta: 'Discuss a campaign on Telegram',
  },

  footer: {
    updated: 'Data updated',
  },

  platformName: {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube Shorts',
    telegram: 'Telegram',
  },
};

export default en;
