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
    <Transition name="fade">
      <div
        v-if="isSidebarOpen"
        @click="isSidebarOpen = false"
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
      ></div>
    </Transition>

    <div class="flex flex-col flex-1 min-w-0 h-full">
      <!-- Top Header -->
      <header class="flex items-center justify-between px-3 sm:px-6 py-3 bg-card border-b border-border flex-shrink-0">
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- Bouton Menu Hamburger -->
          <button
            @click="isSidebarOpen = true"
            class="lg:hidden p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="Ouvrir le menu"
          >
            <Icon name="ph:list" class="w-6 h-6" />
          </button>
          
          <div>
            <h2 class="text-sm sm:text-base font-bold text-text">Zemy Admin</h2>
            <p class="text-xs text-textMuted hidden sm:block">{{ currentDate }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-1.5 sm:space-x-3">
          <NuxtLink to="/notifications" class="p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-xl transition-colors" title="Notifications">
            <Icon name="ph:bell" class="w-5 h-5" />
          </NuxtLink>
          <div class="w-px h-5 bg-border hidden sm:block"></div>
          
          <NuxtLink to="/profile" class="flex items-center space-x-2 hover:bg-primary/5 p-1 sm:p-1.5 rounded-xl transition-colors">
            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm flex-shrink-0">
              {{ authUser?.full_name?.charAt(0)?.toUpperCase() || 'A' }}
            </div>
            <div class="hidden md:block text-left">
              <p class="text-xs sm:text-sm font-semibold text-text leading-tight truncate max-w-[120px]">{{ authUser?.full_name || 'Administrateur' }}</p>
              <p class="text-[10px] text-textMuted truncate max-w-[120px]">{{ authUser?.email || 'Super Admin' }}</p>
            </div>
          </NuxtLink>

          <button
            @click="handleLogout"
            class="p-2 text-textLight hover:text-error hover:bg-error/10 rounded-xl transition-colors"
            title="Se déconnecter"
          >
            <Icon name="ph:sign-out" class="w-5 h-5" />
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-3 sm:p-6">
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
