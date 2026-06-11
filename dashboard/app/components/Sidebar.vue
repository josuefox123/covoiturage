<template>
  <aside class="w-64 bg-card border-r border-border h-full flex flex-col">
    <div class="p-6 flex items-center gap-3">
      <img src="/images/logozemy.png" alt="Zemy Logo" class="h-8 object-contain">
    </div>

    <nav class="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 mt-4 px-2">Menu Principal</div>
      <NuxtLink to="/dashboard" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:squares-four" class="w-5 h-5" />
        <span>Dashboard</span>
      </NuxtLink>
      <NuxtLink to="/users" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:users" class="w-5 h-5" />
        <span>Utilisateurs</span>
      </NuxtLink>
      <NuxtLink to="/rides" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:car" class="w-5 h-5" />
        <span>Trajets</span>
      </NuxtLink>
      <NuxtLink to="/bookings" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:ticket" class="w-5 h-5" />
        <span>Réservations</span>
      </NuxtLink>
      <NuxtLink to="/vehicles" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:steering-wheel" class="w-5 h-5" />
        <span>Véhicules</span>
      </NuxtLink>
      <NuxtLink to="/notifications" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
        <Icon name="ph:megaphone" class="w-5 h-5" />
        <span>Notifications</span>
      </NuxtLink>

      <div class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 mt-4 px-2">Support</div>
      <NuxtLink to="/support" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:chat-circle-dots" class="w-5 h-5" />
        <span>Support Client</span>
      </NuxtLink>
      
      <NuxtLink to="/branding" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text hover:bg-gray-100 transition-colors" active-class="bg-primaryLight text-primaryDark font-semibold">
        <Icon name="ph:paint-brush-broad" class="w-5 h-5" />
        <span>Marque / Logo</span>
      </NuxtLink>
    </nav>
  </aside>
</template>

<style scoped>
a {
  color: theme('colors.textLight');
}
</style>
