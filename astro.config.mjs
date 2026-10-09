import { defineConfig } from 'astro/config';

// Deployed at the root of a GitHub Pages user site (repo: moremaekjupls.github.io).
export default defineConfig({
  site: 'https://moremaekjupls.github.io',
  base: '/',
  build: { format: 'directory' },
  vite: {
    build: {
      // Vite 8 minifies CSS with Lightning CSS, which rewrites the glass effect: it keeps only one of the
      // `backdrop-filter` / `-webkit-backdrop-filter` pair (which one depends on declaration order and its browser
      // targets, so Safari 16-17 or Chrome loses the blur) and turns `blur(0) saturate(100%)` into `blur()saturate()`.
      // esbuild, which Vite used before, emits the declarations as written. Check the glass cards before changing this.
      cssMinify: 'esbuild',
    },
  },
});
