import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: [
        'Chrome >= 49', // Chromium 53
        'Firefox >= 45',
        'Safari >= 10',
        'Edge >= 15'
      ],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser'
  }
});
