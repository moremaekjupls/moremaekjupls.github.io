// ============================================================
//  i18n — all UI strings + page copy live here, RU + EN.
//  Default language: Russian. To tweak any wording, edit below.
// ============================================================

export const languages = ['en'] as const;
export type Lang = (typeof languages)[number];
export const defaultLang: Lang = 'en';

// Build a URL for the given language. RU has no prefix; EN is /en/...
// Base path (e.g. '' at root, '/moremaekjupls' on a project page). Set via astro.config base.
const RAW_BASE = (import.meta.env.BASE_URL || '/');
const BASE = RAW_BASE.replace(/\/+$/, '');

// Remove the base prefix from a runtime pathname.
export function stripBase(path: string): string {
  if (BASE && path.startsWith(BASE)) return path.slice(BASE.length) || '/';
  return path;
}

// Build a URL for the given language. RU has no lang prefix; EN is /en/...
// Always base-prefixed so links work under a subpath deployment.
export function localizeUrl(path: string, _lang?: Lang): string {
  // Single-locale site: URLs need no prefix.
  return path;
}

// Swap the current (runtime, base-included) path to the other language.
export function altLangUrl(path: string, _to?: Lang): string {
  return path;
}

export const ui = {
  ru: {
    'nav.blog': 'Блог',
    'nav.about': 'Обо мне',
    'nav.menu': 'Меню',

    'cta.readBlog': 'Читать блог',
    'cta.live': 'Открыть приложение',
    'cta.allPosts': 'Все посты',
    'cta.readMore': 'Читать',
    'cta.backToBlog': '← Назад к блогу',




    'footer.tagline': 'Продукты на ИИ. Заметки билдера.',
    'footer.rights': 'Все права защищены.',
    'footer.connect': 'Связаться',

    'about.eyebrow': 'Обо мне',
    'about.title': 'От переговорных\nк продуктовым\nрешениям.',
    'about.body': [
      'Я начинал в международных отношениях и дипломатии — там, где результат зависит от умения понять чужой контекст, согласовать интересы и довести договорённость до конкретного действия. Эти же навыки оказались ядром продуктовой работы.',
      'Сегодня я строю продукты с помощью ИИ. Меня интересует не хайп вокруг моделей, а то, что реально доходит до пользователя: какие задачи ИИ закрывает дешевле и быстрее, где он ломается и почему маленькая команда теперь может выпускать то, что вчера требовало целого отдела.',
      'В блоге я разбираю ИИ-новости через призму человека, который сам собирает продукты — без корпоративного тумана, с фокусом на то, что меняет работу билдера.',
    ],

    'blog.eyebrow': 'Блог',
    'blog.title': 'ИИ глазами\nбилдера.',
    'blog.intro':
      'Новости и разборы про искусственный интеллект — с точки зрения человека, который запускает небольшие продукты в одиночку.',
    'blog.empty': 'Пока нет постов.',

    'contact.title': 'Связаться',
    'contact.sub': 'Вопрос, идея или предложение — напишите, отвечаю быстро.',
    'contact.name': 'Имя',
    'contact.email': 'E-mail',
    'contact.message': 'Сообщение',
    'contact.send': 'Отправить',

  },

  en: {
    'nav.blog': 'Blog',
    'nav.about': 'About',
    'nav.menu': 'Menu',

    'cta.readBlog': 'Read the blog',
    'cta.live': 'Open the app',
    'cta.allPosts': 'All posts',
    'cta.readMore': 'Read',
    'cta.backToBlog': '← Back to blog',




    'footer.tagline': 'AI products. A builder’s notes.',
    'footer.rights': 'All rights reserved.',
    'footer.connect': 'Connect',

    'about.eyebrow': 'About',
    'about.title': 'From the\nnegotiating table\nto product\ndecisions.',
    'about.body': [
      'I started in international relations and diplomacy — a field where outcomes depend on reading someone else’s context, aligning interests, and turning an agreement into a concrete next step. The same skills turned out to be the core of product work.',
      'Today I build products with AI. I’m less interested in model hype than in what actually reaches the user: which jobs AI closes faster and cheaper, where it breaks, and why a small team can now ship what used to take a whole department.',
      'On the blog I unpack AI news through the eyes of someone who ships small products himself — no corporate fog, focused on what changes the work of a builder.',
    ],

    'blog.eyebrow': 'Blog',
    'blog.title': 'AI through\na builder’s eyes.',
    'blog.intro':
      'News and analysis about artificial intelligence — from the point of view of someone shipping small products solo.',
    'blog.empty': 'No posts yet.',

    'contact.title': 'Get in touch',
    'contact.sub': 'A question, an idea, a proposal — drop a line, I reply fast.',
    'contact.name': 'Name',
    'contact.email': 'Email',
    'contact.message': 'Message',
    'contact.send': 'Send',

  },
} as const;

export function useTranslations(lang: Lang) {
  return function t(key: string): any {
    const dict: any = ui[lang];
    return dict[key] ?? (ui[defaultLang] as any)[key] ?? key;
  };
}

export function readingMinutes(body: string): number {
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
export function readingLabel(lang: Lang, min: number): string {
  return lang === 'ru' ? `${min} мин` : `${min} min read`;
}
