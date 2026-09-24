// Small helpers shared across pages. The site is English-only.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  return (await getCollection('blog', (e) => !e.data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Pages are built as directories (/blog/index.html), so GitHub Pages serves
 * /blog/ and 301-redirects /blog. Linking with the slash saves that redirect
 * on every click.
 */
export function withSlash(path: string): string {
  return path.endsWith('/') || /\.[a-z0-9]+$/i.test(path) ? path : path + '/';
}

export const postUrl = (p: Post) => `/blog/${p.data.transId}/`;

export function formatDate(d: Date, month: 'short' | 'long' = 'long'): string {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month, day: 'numeric' }).format(d);
}

export function readingLabel(body: string): string {
  const words = (body || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 180))} min read`;
}
