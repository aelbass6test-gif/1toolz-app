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
      },
      plugins: [
        react(), 
        tailwindcss(), 
        // VitePWA({ ... disabled temporarily to fix white screen ... })
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