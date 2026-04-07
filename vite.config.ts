import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isElectronBuild = mode === 'electron'

  return {
    base: isElectronBuild ? './' : '/',
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            konva: ['konva', 'react-konva'],
            pdf: ['jspdf'],
            zip: ['jszip', 'file-saver'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      !isElectronBuild
        ? VitePWA({
            registerType: 'autoUpdate',
            manifest: {
              name: 'Layox',
              short_name: 'Layox',
              description: 'Photo layout editor',
              start_url: '/',
              display: 'standalone',
              background_color: '#111111',
              theme_color: '#111111',
              icons: [
                { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
              ],
            },
          })
        : null,
    ].filter(Boolean),
  }
})
