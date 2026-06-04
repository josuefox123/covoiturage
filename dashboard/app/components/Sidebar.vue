<template>
  <aside class="w-64 bg-card border-r border-border h-full flex flex-col">
    <div class="p-6 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <Icon name="ph:car-profile-fill" class="text-white w-5 h-5" />
      </div>
      <span class="text-xl font-bold text-text">Covoiturage</span>
    </div>

    <nav class="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
      <div class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 mt-4 px-2">Menu Principal</div>
      <NuxtLink to="/" class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-primary/10 hover:text-primary" active-class="bg-primary/10 text-primary font-medium">
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
    </nav>
  </aside>
</template>

<style scoped>
a {
  color: theme('colors.text.light');
}
</style>
