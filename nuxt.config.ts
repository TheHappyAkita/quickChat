// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  future: { compatibilityVersion: 4 },

  typescript: {
    strict: true,
  },

  css: ['~/assets/css/fonts.css'],

  modules: [
    'vuetify-nuxt-module',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  vuetify: {
    moduleOptions: {
      importComposables: true,
    },
    vuetifyOptions: {
      theme: {
        defaultTheme: 'dark',
        themes: {
          dark: {
            colors: {
              primary: '#7C4DFF',
              secondary: '#03DAC6',
              background: '#121212',
              surface: '#1E1E1E',
              error: '#CF6679',
            },
          },
          light: {
            colors: {
              primary: '#6200EE',
              secondary: '#03DAC6',
            },
          },
        },
      },
      icons: {
        defaultSet: 'mdi',
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'quickChat',
      short_name: 'quickChat',
      description: 'Personal AI Chat with Personas',
      theme_color: '#121212',
      background_color: '#121212',
      display: 'standalone',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallbackAllowlist: [/^\/(?!.*api)/],
      type: 'module',
    },
  },

  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || 'quickchat-secret-change-me',
    storageDir: process.env.STORAGE_DIR || '',
    public: {
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    },
  },

  nitro: {
    experimental: {
      wasm: true,
      database: true,
    },
    database: {
      default: {
        connector: 'sqlite',
        options: {
          path: `${process.env.HOME || '~'}/.quickChat/quickchat.sqlite3`,
        },
      },
    },
  },

  vite: {
    define: {
      'process.env.DEBUG': false,
    },
  },
})
