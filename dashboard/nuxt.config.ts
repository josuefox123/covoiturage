/**
 * ==============================================================
 * Fichier :
 * nuxt.config.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon'],

  app: {
    head: {
      title: 'Zemy Admin',
      link: [
        { rel: 'icon', type: 'image/png', href: '/images/logozemy.png' }
      ]
    }
  },



  runtimeConfig: {
    public: {
      apiBase: (globalThis as any).process?.env?.NUXT_PUBLIC_API_BASE || 'https://zemy.erika-app.com/api',
      apiUrl: (globalThis as any).process?.env?.NUXT_PUBLIC_API_BASE || 'https://zemy.erika-app.com/api',
    },
  },

  icon: {
    serverBundle: {
      collections: ['ph']
    }
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'fabric',
      ]
    }
  }
})