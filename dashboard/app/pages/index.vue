<template>
  <div>
    <h1 class="text-2xl font-bold text-text mb-6">Vue d'ensemble</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatsCard 
        title="Total Utilisateurs" 
        :value="stats?.total_users || 0" 
        icon="ph:users-fill" 
        :trend="12.5" 
        colorClass="bg-primary/10 text-primary" 
      />
      <StatsCard 
        title="Trajets Actifs" 
        :value="stats?.active_rides || 0" 
        icon="ph:car-fill" 
        :trend="8.2" 
        colorClass="bg-secondary/10 text-secondary" 
      />
      <StatsCard 
        title="Réservations du mois" 
        :value="stats?.monthly_bookings || 0" 
        icon="ph:ticket-fill" 
        :trend="-2.4" 
        colorClass="bg-warning/10 text-warning" 
      />
      <StatsCard 
        title="Revenus estimés (FCFA)" 
        :value="stats?.estimated_revenue || 0" 
        icon="ph:money-fill" 
        :trend="15.3" 
        colorClass="bg-success/10 text-success" 
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 class="text-lg font-bold text-text mb-4">Évolution des trajets</h3>
        <!-- Placeholder for Chart -->
        <div class="h-64 flex items-end justify-between space-x-2">
          <div v-for="h in [40, 70, 45, 90, 65, 85, 100]" :key="h" class="w-full bg-primary/20 rounded-t-sm relative group">
            <div class="absolute bottom-0 w-full bg-primary rounded-t-sm transition-all duration-500" :style="{ height: h + '%' }"></div>
          </div>
        </div>
        <div class="flex justify-between mt-2 text-xs text-textMuted font-medium">
          <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
        </div>
      </div>

      <div class="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 class="text-lg font-bold text-text mb-4">Répartition</h3>
        <div class="flex items-center justify-center h-48">
          <div class="relative w-40 h-40 rounded-full border-[16px] border-primary flex items-center justify-center">
            <div class="absolute w-full h-full rounded-full border-[16px] border-secondary" style="clip-path: polygon(50% 50%, 100% 0, 100% 100%, 50% 100%);"></div>
            <span class="text-xl font-bold text-text">64%</span>
          </div>
        </div>
        <div class="mt-6 space-y-3">
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center"><span class="w-3 h-3 rounded-full bg-primary mr-2"></span> Conducteurs</div>
            <span class="font-bold">64%</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center"><span class="w-3 h-3 rounded-full bg-secondary mr-2"></span> Passagers</div>
            <span class="font-bold">36%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const { fetchApi } = useApi()
const stats = ref<any>(null)

onMounted(async () => {
  try {
    stats.value = await fetchApi('/dashboard/stats/')
  } catch (e) {
    console.error('Failed to load stats', e)
  }
})
</script>
