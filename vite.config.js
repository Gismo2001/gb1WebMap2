import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// Vite-Konfiguration
export default defineConfig({
  plugins: [
    react(),

    // Legacy-Plugin für alte Browser wie Chromium 53
    legacy({
      targets: [
        'Chrome >= 49', // Chromium 53
        'Firefox >= 45',
        'Safari >= 10',
        'Edge >= 15'
      ],
      // Polyfills für fehlende Features
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true
    })
  ],

  build: {
    // Kein build.target setzen → targets nur im Plugin definieren
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser', // nutzt terser für ES5-Minifizierung
    terserOptions: {
      compress: {
        drop_console: false // Konsolenlogs behalten (optional)
      }
    }
  },

  server: {
    port: 3000,
    open: true
  }
});
