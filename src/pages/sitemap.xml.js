import { getCollection } from 'astro:content';
import { SITE } from '../consts';
export async function GET() {
    const en = await getCollection('blog', (e) => e.data.lang === 'en' && !e.data.draft);
  const urls = [
    '/', '/about', '/blog',
    ...en.map((p) => `/blog/${p.data.transId}`),
  ];
  const body = urls.map((u) => `  <url><loc>${SITE.domain}${u}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
