<!--
==========================================================
Fichier :
default.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex h-screen bg-background overflow-hidden relative">
    <!-- Sidebar -->
    <Sidebar :isOpen="isSidebarOpen" @close="isSidebarOpen = false" />

    <!-- Overlay sombre pour mobile -->
    <div
      v-if="isSidebarOpen"
      @click="isSidebarOpen = false"
      class="fixed inset-0 z-40 bg-black/40 lg:hidden"
    ></div>

    <div class="flex flex-col flex-1 min-w-0">
      <!-- Top Header -->
      <header class="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-card border-b border-border flex-shrink-0">
        <div class="flex items-center gap-3">
          <!-- Bouton Menu Hamburger -->
          <button
            @click="isSidebarOpen = true"
            class="lg:hidden p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Ouvrir le menu"
          >
            <Icon name="ph:list" class="w-6 h-6" />
          </button>
          
          <div>
            <h2 class="text-base font-semibold text-text">Tableau de bord</h2>
            <p class="text-xs text-textMuted hidden sm:block">{{ currentDate }}</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <button class="p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Notifications">
            <Icon name="ph:bell" class="w-5 h-5" />
          </button>
          <div class="w-px h-6 bg-border"></div>
          <div class="flex items-center space-x-2">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {{ authUser?.full_name?.charAt(0)?.toUpperCase() || 'A' }}
            </div>
            <div class="hidden sm:block">
              <p class="text-sm font-semibold text-text leading-none">{{ authUser?.full_name || 'Administrateur' }}</p>
              <p class="text-xs text-textMuted mt-0.5">{{ authUser?.email || 'Super Admin' }}</p>
            </div>
          </div>
          <NuxtLink
            to="/profile"
            class="p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Mon Profil"
          >
            <Icon name="ph:user" class="w-5 h-5" />
          </NuxtLink>
          <button
            @click="handleLogout"
            class="p-2 text-textLight hover:text-error hover:bg-error/10 rounded-lg transition-colors"
            title="Se déconnecter"
          >
            <Icon name="ph:sign-out" class="w-5 h-5" />
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'

const { logout } = useApi()
const route = useRoute()
const authUser = useCookie<any>('user')

const isSidebarOpen = ref(false)

// Fermer le menu lors du changement de page
watch(() => route.path, () => {
  isSidebarOpen.value = false
})

const currentDate = computed(() => {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

function handleLogout() {
  logout()
}
</script>
