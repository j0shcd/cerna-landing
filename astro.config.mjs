// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://cerna.example',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    // Keep the churny dependency cache out of iCloud sync (see the icloud-sync skill).
    cacheDir: 'node_modules/.vite.nosync',
  },
});
