import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }
              if (id.includes('node_modules/lucide-react/')) {
                return 'vendor-lucide';
              }
              if (id.includes('node_modules/recharts/')) {
                return 'vendor-recharts';
              }
              if (id.includes('node_modules/@supabase/')) {
                return 'vendor-supabase';
              }
              if (id.includes('node_modules/xlsx/')) {
                return 'vendor-xlsx';
              }
              if (id.includes('node_modules/motion/')) {
                return 'vendor-motion';
              }
              if (id.includes('node_modules/@google/genai/')) {
                return 'vendor-genai';
              }
              return 'vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      host: true,
      port: 3000,
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : {
              overlay: false,
            },
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
