// ============================================================
//  UI strings and page copy. To tweak any wording, edit below.
// ============================================================

const ui = {
  'nav.blog': 'Blog',
  'nav.about': 'About',
  'nav.menu': 'Menu',

  'cta.readBlog': 'Read the blog',
  'cta.allPosts': 'All posts',
  'cta.backToBlog': '← Back to blog',

  'footer.tagline': 'AI products. A builder’s notes.',
  'footer.rights': 'All rights reserved.',
  'footer.connect': 'Connect',

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
} as const;

export function t(key: string): any {
  return (ui as any)[key] ?? key;
}

export function readingMinutes(body: string): number {
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
export function readingLabel(min: number): string {
  return `${min} min read`;
}
