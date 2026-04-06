import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['Chrome >= 53'], // Chromium 53 for webOS 4.0
    }),
  ],
  build: {
    minify: false, // Optional: Disable minification for debugging
  },
});