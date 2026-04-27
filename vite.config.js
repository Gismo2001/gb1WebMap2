import { defineConfig } from 'vite';

export default defineConfig({
  // Keine Plugins mehr (außer du nutzt z.B. noch @vitejs/plugin-vue oder ähnliches)
  plugins: [], 
  build: {
    target: 'es2015', // Bleib dabei, das ist sicher für die meisten Browser
    minify: 'esbuild', 
  },
});