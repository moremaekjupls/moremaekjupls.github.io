import { getPosts, postUrl } from '../lib/site';
import { SITE } from '../consts';
export async function GET() {
  const posts = await getPosts();
  const urls = [
    '/', '/about/', '/blog/', '/history/',
    ...posts.map(postUrl),
  ];
  const body = urls.map((u) => `  <url><loc>${SITE.domain}${u}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
