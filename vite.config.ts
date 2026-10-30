import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'url';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        hmr: false,
      },
      plugins: [
        react(), 
        tailwindcss(), 
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
          manifest: {
            id: '/',
            name: 'مدير الأوردرات الذكي | AbdoMedia Prime',
            short_name: 'الأوردرات',
            description: 'المنظومة الذكية المتكاملة لإدارة الأوردرات والشحن والمخزون وحسابات الشركاء.',
            theme_color: '#008060',
            background_color: '#0f172a',
            display: 'standalone',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            // Do not serve a potentially old precached index.html for deep links.
            // Cloudflare Workers Static Assets already performs the SPA fallback,
            // so navigations should reach the network first and receive the
            // currently deployed application shell. Keep a short offline fallback.
            navigateFallbackDenylist: [/^\/.+/],
            runtimeCaching: [
              {
                urlPattern: ({ request }) => request.mode === 'navigate',
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'app-navigation-cache',
                  networkTimeoutSeconds: 5,
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 60 * 60 * 24,
                  },
                  cacheableResponse: {
                    statuses: [200],
                  },
                  precacheFallback: {
                    fallbackURL: '/index.html',
                  },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
            ],
          },
          devOptions: {
            enabled: true,
            type: 'module',
          },
        }),
      ],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      },
      build: {
        reportCompressedSize: false,
        sourcemap: false,
        minify: 'esbuild',
        target: 'es2020',
        cssCodeSplit: true,
        chunkSizeWarningLimit: 3000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('firebase')) return 'vendor-firebase';
                if (id.includes('recharts')) return 'vendor-recharts';
                if (id.includes('xlsx')) return 'vendor-xlsx';
                if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html-to-image')) return 'vendor-pdf';
                if (id.includes('@google/genai')) return 'vendor-ai';
                if (id.includes('@vis.gl') || id.includes('google-maps')) return 'vendor-maps';
                if (id.includes('qrcode')) return 'vendor-qrcode';
                if (id.includes('lucide-react')) return 'vendor-lucide';
                if (id.includes('@supabase')) return 'vendor-supabase';
                if (id.includes('framer-motion') || id.includes('motion')) return 'vendor-motion';
                if (id.includes('date-fns')) return 'vendor-date-fns';
                if (id.includes('dexie')) return 'vendor-dexie';
                return 'vendor-others';
              }
            }
          }
        }
      }
    };
});
