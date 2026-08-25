import { defineConfig } from 'astro/config';

// Deployed at the root of a GitHub Pages user site (repo: moremaekjupls.github.io).
export default defineConfig({
  site: 'https://moremaekjupls.github.io',
  base: '/',
  build: { format: 'directory' },
});
