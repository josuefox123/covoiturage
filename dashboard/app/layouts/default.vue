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
  <div class="flex h-screen bg-background overflow-hidden">
    <Sidebar />
    <div class="flex flex-col flex-1 min-w-0">
      <!-- Top Header -->
      <header class="flex items-center justify-between px-6 py-3.5 bg-card border-b border-border flex-shrink-0">
        <div>
          <h2 class="text-base font-semibold text-text">Tableau de bord</h2>
          <p class="text-xs text-textMuted">{{ currentDate }}</p>
        </div>
        <div class="flex items-center space-x-3">
          <button class="p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Notifications">
            <Icon name="ph:bell" class="w-5 h-5" />
          </button>
          <div class="w-px h-6 bg-border"></div>
          <div class="flex items-center space-x-2">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              A
            </div>
            <div class="hidden sm:block">
              <p class="text-sm font-semibold text-text leading-none">Administrateur</p>
              <p class="text-xs text-textMuted mt-0.5">Super Admin</p>
            </div>
          </div>
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
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const { logout } = useApi()

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
