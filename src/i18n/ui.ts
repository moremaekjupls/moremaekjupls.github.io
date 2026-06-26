// ============================================================
//  i18n — all UI strings + page copy live here, RU + EN.
//  Default language: Russian. To tweak any wording, edit below.
// ============================================================

export const languages = ['ru', 'en'] as const;
export type Lang = (typeof languages)[number];
export const defaultLang: Lang = 'ru';

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
export function localizeUrl(path: string, lang: Lang): string {
  const clean = '/' + path.replace(/^\/+/, '');
  const tail = lang === 'en' ? ('/en' + (clean === '/' ? '' : clean)) : clean;
  const out = BASE + tail;
  return out || '/';
}

// Swap the current (runtime, base-included) path to the other language.
export function altLangUrl(path: string, to: Lang): string {
  let p = stripBase(path);
  if (p.startsWith('/en/')) p = p.slice(3);
  else if (p === '/en') p = '/';
  return localizeUrl(p, to);
}

export const ui = {
  ru: {
    'nav.project': 'Проект',
    'nav.blog': 'Блог',
    'nav.about': 'Обо мне',
    'nav.menu': 'Меню',

    'cta.viewProject': 'Смотреть проект',
    'cta.readBlog': 'Читать блог',
    'cta.live': 'Открыть приложение',
    'cta.allPosts': 'Все посты',
    'cta.readMore': 'Читать',
    'cta.backToBlog': '← Назад к блогу',

    'hero.eyebrow': 'Дипломатия → продукты на ИИ',
    'hero.title': 'Строю продукты\nна стыке людей\nи искусственного\nинтеллекта.',
    'hero.sub':
      'Хондамир Бегматов. Из международных отношений — в продукты на ИИ. Строю, запускаю и пишу про то, что реально работает.',

    'featured.eyebrow': 'Избранный проект',
    'featured.title': 'NURA',
    'featured.tagline': 'Трекер калорий, который читает тарелку по фото.',
    'featured.desc':
      'Веб-приложение, которое оценивает калории и БЖУ по фотографии блюда или текстовому описанию. Один снимок — и дневник питания заполнен.',

    'manifesto.eyebrow': 'Во что я верю',
    'manifesto.text': 'Чтобы построить продукт, больше не нужно уметь писать код — нужны идея и воображение, чтобы за ней пойти. ИИ убрал стену между «придумал» и «сделал».',
    'latest.title': 'Последнее в блоге',
    'latest.subtitle': 'ИИ-новости и разбор глазами продукт-билдера.',

    'footer.tagline': 'Продукты на ИИ. Заметки билдера.',
    'footer.rights': 'Все права защищены.',
    'footer.connect': 'Связаться',

    'about.eyebrow': 'Обо мне',
    'about.title': 'От переговорных\nк продуктовым\nрешениям.',
    'about.body': [
      'Я начинал в международных отношениях и дипломатии — там, где результат зависит от умения понять чужой контекст, согласовать интересы и довести договорённость до конкретного действия. Эти же навыки оказались ядром продуктовой работы.',
      'Сегодня я строю продукты с помощью ИИ. Меня интересует не хайп вокруг моделей, а то, что реально доходит до пользователя: какие задачи ИИ закрывает дешевле и быстрее, где он ломается и почему маленькая команда теперь может выпускать то, что вчера требовало целого отдела.',
      'NURA — мой текущий проект: трекер калорий, оценивающий питание по фото. В блоге я разбираю ИИ-новости через призму человека, который сам собирает продукты — без корпоративного тумана, с фокусом на то, что меняет работу билдера.',
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

    'project.eyebrow': 'Кейс',
    'project.title': 'NURA',
    'project.tagline': 'Калории и БЖУ по одному фото.',
    'project.live': 'Открыть приложение',
    'project.screenshots': 'Скриншоты',
    'project.screenshotsNote': 'Здесь будут реальные экраны приложения.',
    'project.sections': {
      problem: {
        label: 'Проблема',
        heading: 'Считать калории — скучно, поэтому это бросают.',
        body: [
          'Большинство трекеров питания требуют вручную искать продукт в базе, угадывать граммовку и заносить каждый ингредиент. На реальной тарелке с пятью составляющими это занимает минуты — и через неделю человек сдаётся.',
          'Барьер не в мотивации, а в трении. Если внесение приёма пищи занимает 30 секунд, дневник ведут. Если три минуты — нет.',
        ],
      },
      what: {
        label: 'Что делает',
        heading: 'Фото или фраза — и приём пищи посчитан.',
        body: [
          'NURA принимает фотографию блюда или текстовое описание («овсянка с бананом и горсть миндаля») и возвращает оценку калорий и БЖУ: белки, жиры, углеводы.',
          'Никакого ручного поиска по базе. Пользователь подтверждает или поправляет оценку — и запись уходит в дневник.',
        ],
        bullets: [
          'Распознавание блюда по фото',
          'Ввод текстом на естественном языке',
          'Оценка калорий и БЖУ',
          'Быстрое подтверждение и правка',
        ],
      },
      how: {
        label: 'Как собрано',
        heading: 'Мультимодальная модель плюс тонкий продуктовый слой.',
        body: [
          'Ядро — мультимодальная LLM, которая распознаёт еду и оценивает порции. Вокруг неё — лёгкий веб-интерфейс, слой подсказок (prompt) для стабильного формата ответа и валидация чисел на стороне приложения.',
          'Принцип сборки: не дообучать свою модель там, где задачу закрывает хорошая модель общего назначения и аккуратный промпт. Это позволило дойти от идеи до рабочего прототипа в одиночку и за недели, а не месяцы.',
        ],
      },
      result: {
        label: 'Результат и выводы',
        heading: 'Трение снято — дневник ведётся.',
        body: [
          'Главная метрика для меня — сколько секунд занимает внести приём пищи. Фото-ввод убирает основной барьер традиционных трекеров.',
          'Что я вынес: точность оценки «достаточно хорошая» бьёт «идеальную, но медленную»; пользователю важнее скорость и доверие к цифре, чем второй знак после запятой. И что один человек с правильными ИИ-инструментами сегодня закрывает то, что недавно требовало команды.',
        ],
      },
    },
    'project.stats': [
      { num: '1 фото', label: 'на один приём пищи' },
      { num: '~10 сек', label: 'на запись вместо минут' },
      { num: '2 способа', label: 'ввода: фото или текст' },
    ],
  },

  en: {
    'nav.project': 'Project',
    'nav.blog': 'Blog',
    'nav.about': 'About',
    'nav.menu': 'Menu',

    'cta.viewProject': 'View project',
    'cta.readBlog': 'Read the blog',
    'cta.live': 'Open the app',
    'cta.allPosts': 'All posts',
    'cta.readMore': 'Read',
    'cta.backToBlog': '← Back to blog',

    'hero.eyebrow': 'Diplomacy → AI products',
    'hero.title': 'Building products\nwhere people meet\nartificial\nintelligence.',
    'hero.sub':
      'Khondamir Begmatov. From international relations to AI products. I build, ship, and write about what actually works.',

    'featured.eyebrow': 'Featured project',
    'featured.title': 'NURA',
    'featured.tagline': 'A calorie tracker that reads your plate from a photo.',
    'featured.desc':
      'A web app that estimates calories and macros from a photo of a meal or a short text description. One snapshot and your food log is filled in.',

    'manifesto.eyebrow': 'What I believe',
    'manifesto.text': 'You no longer need to write code to build a product — you need an idea, and the imagination to chase it. AI removed the wall between “thought of it” and “built it”.',
    'latest.title': 'Latest from the blog',
    'latest.subtitle': 'AI news and analysis through a small-product builder lens.',

    'footer.tagline': 'AI products. A builder’s notes.',
    'footer.rights': 'All rights reserved.',
    'footer.connect': 'Connect',

    'about.eyebrow': 'About',
    'about.title': 'From the\nnegotiating table\nto product\ndecisions.',
    'about.body': [
      'I started in international relations and diplomacy — a field where outcomes depend on reading someone else’s context, aligning interests, and turning an agreement into a concrete next step. The same skills turned out to be the core of product work.',
      'Today I build products with AI. I’m less interested in model hype than in what actually reaches the user: which jobs AI closes faster and cheaper, where it breaks, and why a small team can now ship what used to take a whole department.',
      'NURA is my current project: a calorie tracker that estimates a meal from a photo. On the blog I unpack AI news through the eyes of someone who ships small products himself — no corporate fog, focused on what changes the work of a builder.',
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

    'project.eyebrow': 'Case study',
    'project.title': 'NURA',
    'project.tagline': 'Calories and macros from a single photo.',
    'project.live': 'Open the app',
    'project.screenshots': 'Screenshots',
    'project.screenshotsNote': 'Real app screens will go here.',
    'project.sections': {
      problem: {
        label: 'Problem',
        heading: 'Counting calories is tedious, so people quit.',
        body: [
          'Most food trackers make you search a database by hand, guess the gram weight, and log every ingredient. On a real plate with five components that takes minutes — and within a week people give up.',
          'The barrier isn’t motivation, it’s friction. If logging a meal takes 30 seconds, people keep a diary. If it takes three minutes, they don’t.',
        ],
      },
      what: {
        label: 'What it does',
        heading: 'A photo or a sentence — and the meal is logged.',
        body: [
          'NURA takes a photo of a dish or a text description ("oatmeal with a banana and a handful of almonds") and returns an estimate of calories and macros: protein, fat, carbs.',
          'No manual database search. The user confirms or adjusts the estimate, and the entry goes into the log.',
        ],
        bullets: [
          'Dish recognition from a photo',
          'Natural-language text input',
          'Calorie and macro estimation',
          'Fast confirm and edit',
        ],
      },
      how: {
        label: 'How it was built',
        heading: 'A multimodal model plus a thin product layer.',
        body: [
          'The core is a multimodal LLM that recognizes food and estimates portions. Around it sits a lightweight web interface, a prompt layer for a stable response format, and number validation on the app side.',
          'The build principle: don’t fine-tune your own model where a good general model and a careful prompt already do the job. That’s what made it possible to go from idea to working prototype solo, in weeks rather than months.',
        ],
      },
      result: {
        label: 'Result & learnings',
        heading: 'Friction removed — the log gets kept.',
        body: [
          'The metric I care about is how many seconds it takes to log a meal. Photo input removes the main barrier of traditional trackers.',
          'What I took away: a "good enough" estimate beats a "perfect but slow" one; users value speed and trust in the number more than a second decimal place. And that one person with the right AI tools now covers what recently took a team.',
        ],
      },
    },
    'project.stats': [
      { num: '1 photo', label: 'per meal' },
      { num: '~10 sec', label: 'to log, not minutes' },
      { num: '2 ways', label: 'to input: photo or text' },
    ],
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
