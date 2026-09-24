import { defineCollection, z } from 'astro:content';

// Blog collection. To add a post: drop a new .md file in src/content/blog/
// (one per language). See README → "Adding a blog post".
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    pubDate: z.coerce.date(),
    // transId is the URL slug: /blog/<transId>/
    transId: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
