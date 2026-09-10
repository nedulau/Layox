import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isElectronBuild = mode === 'electron'
  const developmentConnectSources = command === 'serve'
    ? ' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*'
    : ''

  return {
    base: isElectronBuild ? './' : '/',
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'konva', test: /node_modules[\\/](?:konva|react-konva)[\\/]/ },
              { name: 'react', test: /node_modules[\\/](?:react|react-dom)[\\/]/ },
            ],
          },
        },
      },
    },
    plugins: [
      {
        name: 'layox-content-security-policy',
        transformIndexHtml: (html: string) => html.replace(
          '__LAYOX_DEVELOPMENT_CONNECT_SOURCES__',
          developmentConnectSources,
        ),
      },
      react(),
      tailwindcss(),
      VitePWA({
            disable: isElectronBuild,
            registerType: 'prompt',
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
          }),
    ].filter(Boolean),
  }
})
