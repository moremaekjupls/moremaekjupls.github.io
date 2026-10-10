import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Blog collection. To add a post: drop a new .md file in src/content/blog/
// (one per language). See README → "Adding a blog post".
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
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
