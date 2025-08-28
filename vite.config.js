import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    fs: {
      strict: false // Allow serving files from outside root
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  assetsInclude: ['**/*.glb', '**/*.png', '**/*.json']
});