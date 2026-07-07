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
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-text">Vérifications d'identité</h1>
        <span v-if="pendingCount > 0" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning text-white">
          {{ pendingCount }} en attente
        </span>
      </div>
      <button @click="fetchRequests" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-textMuted text-sm hover:bg-background transition-colors w-fit">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
        Actualiser
      </button>
    </div>

    <!-- Stats or Filters -->
    <div class="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
      <button 
        @click="filterStatus = 'all'" 
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="filterStatus === 'all' ? 'bg-primary text-white' : 'bg-card text-textMuted hover:bg-primary/5'"
      >
        Toutes
      </button>
      <button 
        @click="filterStatus = 'pending'" 
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="filterStatus === 'pending' ? 'bg-warning text-white' : 'bg-card text-textMuted hover:bg-warning/10'"
      >
        En attente
      </button>
      <button 
        @click="filterStatus = 'approved'" 
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="filterStatus === 'approved' ? 'bg-success text-white' : 'bg-card text-textMuted hover:bg-success/10'"
      >
        Approuvées
      </button>
      <button 
        @click="filterStatus = 'rejected'" 
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="filterStatus === 'rejected' ? 'bg-error text-white' : 'bg-card text-textMuted hover:bg-error/10'"
      >
        Rejetées
      </button>
    </div>

    <div class="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div v-if="pending" class="p-8 text-center text-textMuted">
        <svg class="w-8 h-8 animate-spin mx-auto mb-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p>Chargement des vérifications...</p>
      </div>
      <div v-else-if="filteredRequests.length === 0" class="p-8 text-center text-textMuted">
        <svg class="w-12 h-12 mx-auto mb-3 text-border" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>
        <p>Aucune demande de vérification pour ce statut.</p>
      </div>
      <table v-else class="w-full text-sm text-left">
        <thead class="text-xs text-textMuted uppercase bg-background/50 border-b border-border">
          <tr>
            <th class="px-6 py-4 font-medium">Utilisateur</th>
            <th class="px-6 py-4 font-medium">Date de soumission</th>
            <th class="px-6 py-4 font-medium">Statut</th>
            <th class="px-6 py-4 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="req in filteredRequests" :key="req.id" class="hover:bg-background/50 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <img :src="req.user_details.avatar || '/images/default-avatar.png'" class="w-10 h-10 rounded-full object-cover border border-border" />
                <div>
                  <div class="font-medium text-text">{{ req.user_details.full_name || 'Non renseigné' }}</div>
                  <div class="text-xs text-textMuted">{{ req.user_details.phone }}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-textLight">
              {{ new Date(req.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) }}
            </td>
            <td class="px-6 py-4">
              <span 
                class="px-2.5 py-1 rounded-full text-xs font-medium"
                :class="{
                  'bg-warning/10 text-warning': req.status === 'pending',
                  'bg-success/10 text-success': req.status === 'approved',
                  'bg-error/10 text-error': req.status === 'rejected'
                }"
              >
                {{ 
                  req.status === 'pending' ? 'En attente' :
                  req.status === 'approved' ? 'Approuvée' : 'Rejetée' 
                }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <NuxtLink :to="`/verifications/${req.id}`" class="inline-flex items-center justify-center p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
const { fetchApi } = useApi()
const requests = ref<any[]>([])
const pending = ref(true)
const filterStatus = ref('all') // 'all', 'pending', 'approved', 'rejected'

const pendingCount = computed(() => requests.value.filter((r: any) => r.status === 'pending').length)

const fetchRequests = async () => {
  pending.value = true
  try {
    const data = await fetchApi('/verifications/')
    requests.value = data?.results || data || []
  } catch (error) {
    console.error('Failed to fetch verifications', error)
  } finally {
    pending.value = false
  }
}

const filteredRequests = computed(() => {
  if (filterStatus.value === 'all') return requests.value
  return requests.value.filter((r: any) => r.status === filterStatus.value)
})

onMounted(() => {
  fetchRequests()
  // Auto-refresh toutes les 30s
  const interval = setInterval(fetchRequests, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>
