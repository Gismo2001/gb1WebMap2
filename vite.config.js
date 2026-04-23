import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['Chrome >= 53'],
      // Fügt notwendige Funktionen hinzu, die alte Browser nicht kennen
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
  ],
  build: {
    // Terser ist für den Legacy-Build oft zuverlässiger als esbuild
    minify: 'terser', 
    // Sorgt dafür, dass der "normale" Build auch nicht zu extrem modern ist
    target: 'es2015',
  },
});