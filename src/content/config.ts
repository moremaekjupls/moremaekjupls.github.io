import { defineCollection, z } from 'astro:content';

// Blog collection. To add a post: drop a new .md file in src/content/blog/.
// See README → «Как добавить пост».
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    pubDate: z.coerce.date(),
    lang: z.enum(['en']),
    // transId is the URL slug: /blog/<transId>.
    transId: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
