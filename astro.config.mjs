// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://cerna.example',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
