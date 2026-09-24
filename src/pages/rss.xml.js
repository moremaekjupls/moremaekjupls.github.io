import { getPosts, postUrl } from '../lib/site';
import { SITE } from '../consts';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export async function GET() {
  const posts = await getPosts();
  const items = posts.map((p) => `    <item>
      <title>${esc(p.data.title)}</title>
      <link>${SITE.domain}${postUrl(p)}</link>
      <guid>${SITE.domain}${postUrl(p)}</guid>
      <pubDate>${p.data.pubDate.toUTCString()}</pubDate>
      <description>${esc(p.data.excerpt)}</description>
    </item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>Khondamir — Blog</title>
    <link>${SITE.domain}/blog/</link>
    <description>AI news and analysis through a builder's lens</description>
    <language>en</language>
${items}
  </channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
