import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: '焼き鳥人間 会計',
        short_name: '焼き鳥人間',
        lang: 'ja',
        start_url: '/',
        display: 'standalone',
        background_color: '#fffef8',
        theme_color: '#ffdf58',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,jpg,gif,webp,woff2,webmanifest}',
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        skipWaiting: false,
        clientsClaim: true,
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'], setupFiles: ['src/test-setup.ts'] },
});
