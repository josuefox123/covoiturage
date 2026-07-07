<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="space-y-8 pb-12">
    <div class="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
      <div>
        <h1 class="text-3xl font-bold text-text mb-1 tracking-tight">Vue d'ensemble</h1>
        <p class="text-textMuted font-medium">Bienvenue sur votre tableau de bord administrateur Zemy</p>
      </div>
      <div class="flex space-x-3 self-start md:self-auto">
        <button class="flex items-center space-x-2 bg-white border border-border px-4 py-2 rounded-xl text-sm font-bold text-text hover:bg-background transition-colors shadow-sm">
          <Icon name="ph:export" class="w-4 h-4" />
          <span>Exporter</span>
        </button>
        <button @click="refreshData" :disabled="loading" class="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:opacity-70">
          <Icon name="ph:arrows-clockwise" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
          <span>Actualiser</span>
        </button>
      </div>
    </div>
    
    <!-- Carte Large au Sommet -->
    <div class="w-full">
      <LiveMap :mapData="stats?.map_data || []" :loading="initialLoading" />
    </div>
    
    <!-- 1. Cartes Rapides (Stats) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard 
        title="Total Utilisateurs" 
        :value="stats?.users?.total || 0" 
        icon="ph:users-fill" 
        :trend="5.2" 
        colorClass="bg-primary/10 text-primary" 
        :loading="initialLoading"
      />
      <StatCard 
        title="Trajets Actifs" 
        :value="stats?.rides?.active || 0" 
        icon="ph:car-fill" 
        :trend="12.4" 
        colorClass="bg-secondary/10 text-secondary" 
        :loading="initialLoading"
      />
      <StatCard 
        title="Réservations (Aujourd'hui)" 
        :value="stats?.bookings?.today || 0" 
        icon="ph:ticket-fill" 
        :trend="-2.1" 
        colorClass="bg-warning/10 text-warning" 
        :loading="initialLoading"
      />
      <StatCard 
        title="Revenus Mensuels" 
        :value="stats?.financials?.monthly_revenue || 0" 
        icon="ph:money-fill" 
        unit="FCFA"
        :trend="18.5" 
        colorClass="bg-success/10 text-success" 
        :loading="initialLoading"
      />
    </div>

    <!-- 2. Graphiques Principaux -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <RevenueChart :data="stats?.charts?.revenue_7d || []" :loading="initialLoading" />
      </div>
      <div>
        <DistributionChart 
          title="Répartition Utilisateurs" 
          :labels="['Passagers', 'Conducteurs', 'En attente']"
          :series="[stats?.users?.passengers || 0, stats?.users?.drivers || 0, stats?.users?.pending_verifications || 0]"
          :colors="['#4F46E5', '#10B981', '#F59E0B']"
          :loading="initialLoading"
        />
      </div>
    </div>

    <!-- 3. Activités -->
    <div class="grid grid-cols-1 gap-6">
      <div>
        <RecentActivity :activities="stats?.activities || []" :loading="initialLoading" />
      </div>
    </div>
    
    <!-- 4. Tableaux -->
    <div class="grid grid-cols-1 gap-6">
      <DataTable 
        title="Dernières réservations" 
        :columns="[
          { key: 'id', label: 'ID' },
          { key: 'user', label: 'Utilisateur' },
          { key: 'type', label: 'Action' },
          { key: 'time', label: 'Date' }
        ]"
        :data="recentBookingsTableData"
        :loading="initialLoading"
      >
        <template #cell-time="{ row }">
          {{ formatDate(row.time) }}
        </template>
        <template #cell-id="{ row }">
          <span class="font-mono text-xs bg-background px-2 py-1 rounded border border-border">{{ row.id }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import StatCard from '../../components/dashboard/StatCard.vue'
import RevenueChart from '../../components/dashboard/RevenueChart.vue'
import DistributionChart from '../../components/dashboard/DistributionChart.vue'
import RecentActivity from '../../components/dashboard/RecentActivity.vue'
import LiveMap from '../../components/dashboard/LiveMap.vue'
import DataTable from '../../components/dashboard/DataTable.vue'

const { fetchApi } = useApi()
const stats = ref<any>(null)
const loading = ref(false)
const initialLoading = ref(true)
let pollingInterval: any = null

const recentBookingsTableData = computed(() => {
  if (!stats.value?.activities) return []
  return stats.value.activities.filter((a: any) => a.type.includes('réservation'))
})

const formatDate = (timeStr: string) => {
  if (!timeStr) return ''
  return new Intl.DateTimeFormat('fr-FR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(timeStr))
}

const loadData = async (isInitial = false) => {
  if (isInitial) initialLoading.value = true
  else loading.value = true
  
  try {
    stats.value = await fetchApi('/dashboard/stats/')
  } catch (e) {
    console.error('Failed to load stats', e)
  } finally {
    initialLoading.value = false
    loading.value = false
  }
}

const refreshData = () => loadData(false)

onMounted(() => {
  loadData(true)
  // Polling intelligent toutes les 30 secondes
  pollingInterval = setInterval(() => {
    // On ne poll que si l'onglet est actif
    if (document.visibilityState === 'visible') {
      loadData(false)
    }
  }, 30000)
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})
</script>
