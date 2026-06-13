import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // legacy() wurde entfernt
  ],
  build: {
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/lgln-stac': {
        target: 'https://dgm.stac.lgln.niedersachsen.de',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/lgln-stac/, ''),
      },

      '/dgm': {
        target: 'https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/dgm/, ''),
      },

      '/dom': {
        target: 'https://dom1.s3.eu-de.cloud-object-storage.appdomain.cloud',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/dom/, ''),
      },
      '/lgln-wfs': {
        target: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/lgln-wfs/, ''),
      }
    },
  },
  preview: {
    host: '0.0.0.0'
  },
});
