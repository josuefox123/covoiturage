<!--
==========================================================
Fichier :
Sidebar.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <aside
    :class="[
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border h-full flex flex-col transition-transform duration-300 ease-in-out'
    ]"
  >
    <div class="p-6 flex items-center justify-between gap-3">
      <img src="/images/logozemy.png" alt="Zemy Logo" class="h-8 object-contain">
      <!-- Bouton de fermeture mobile -->
      <button
        @click="$emit('close')"
        class="lg:hidden p-1.5 text-textLight hover:text-error hover:bg-error/10 rounded-lg transition-colors"
        title="Fermer le menu"
      >
        <Icon name="ph:x" class="w-5 h-5" />
      </button>
    </div>

    <nav class="flex-1 px-4 py-4 space-y-1 overflow-y-auto" @click="$emit('close')">
      <div class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 mt-4 px-2">Menu Principal</div>
      <NuxtLink to="/dashboard" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:squares-four" class="w-5 h-5" />
        <span>Dashboard</span>
      </NuxtLink>
      <NuxtLink to="/users" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:users" class="w-5 h-5" />
        <span>Utilisateurs</span>
      </NuxtLink>
      <NuxtLink to="/verifications" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:shield-check" class="w-5 h-5" />
        <span>Vérifications</span>
      </NuxtLink>
      <NuxtLink to="/rides" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:car" class="w-5 h-5" />
        <span>Trajets</span>
      </NuxtLink>
      <NuxtLink to="/bookings" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:ticket" class="w-5 h-5" />
        <span>Réservations</span>
      </NuxtLink>
      <NuxtLink to="/parcels" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:package" class="w-5 h-5" />
        <span>Colis</span>
      </NuxtLink>
      <NuxtLink to="/vehicles" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:steering-wheel" class="w-5 h-5" />
        <span>Véhicules</span>
      </NuxtLink>
      <NuxtLink to="/notifications" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:megaphone" class="w-5 h-5" />
        <span>Notifications</span>
      </NuxtLink>
      <NuxtLink to="/promotions" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:star" class="w-5 h-5" />
        <span>Promotions</span>
      </NuxtLink>

      <div class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 mt-4 px-2">Finances</div>
      <NuxtLink to="/payments" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:credit-card" class="w-5 h-5" />
        <span>Paiements</span>
      </NuxtLink>
      <NuxtLink to="/financial-settings" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:money" class="w-5 h-5" />
        <span>Commissions</span>
      </NuxtLink>
      <NuxtLink to="/refunds" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:receipt" class="w-5 h-5" />
        <span>Remboursements</span>
      </NuxtLink>

      <div class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 mt-4 px-2">Support</div>
      <NuxtLink to="/support" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:chat-circle-dots" class="w-5 h-5" />
        <span>Support Client</span>
      </NuxtLink>

      <NuxtLink to="/support/tickets" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:ticket" class="w-5 h-5" />
        <span>Tickets Support</span>
      </NuxtLink>
      
      <NuxtLink to="/branding" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:paint-brush-broad" class="w-5 h-5" />
        <span>Marque / Logo</span>
      </NuxtLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])
</script>

<style scoped>
a {
  color: theme('colors.textLight');
}
</style>
