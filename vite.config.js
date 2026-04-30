import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['> 0.5%', 'last 2 versions', 'Firefox ESR', 'not dead', 'Safari >= 11'],
      modernPolyfills: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    })
  ],
  build: {
    sourcemap: true,
  },
  server: {
    host: '0.0.0.0',
    proxy: {

      // Proxy für LGN-STAC (bestehend)
      '/lgln-stac': {
        target: 'https://dgm.stac.lgln.niedersachsen.de',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/lgln-stac/, ''),
      },

      // Proxy für DGM GeoTIFFs
      '/dgm': {
        target: 'https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/dgm/, '')
        },

      // Proxy für DOM GeoTIFFs
      '/dom': {
        target: 'https://dom1.s3.eu-de.cloud-object-storage.appdomain.cloud',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/dom/, ''),
      }

    },
  },
  preview: {
    host: '0.0.0.0'
  },
});