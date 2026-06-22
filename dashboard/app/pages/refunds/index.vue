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
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-text">Demandes de Remboursement</h1>
        <p class="text-textMuted mt-1">Gérez les demandes d'annulation et de remboursement des passagers.</p>
      </div>
      <button @click="fetchRefunds" class="p-2 bg-card border border-border rounded-lg text-textLight hover:text-primary transition-colors">
        <Icon name="ph:arrows-clockwise" class="w-5 h-5" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/50 border-b border-border text-textMuted font-semibold">
            <tr>
              <th class="px-6 py-4">ID</th>
              <th class="px-6 py-4">Passager</th>
              <th class="px-6 py-4">Conducteur</th>
              <th class="px-6 py-4">Montant</th>
              <th class="px-6 py-4">Raison</th>
              <th class="px-6 py-4">Statut</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="loading && refunds.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-textMuted">
                Chargement des demandes...
              </td>
            </tr>
            <tr v-else-if="refunds.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-textMuted">
                Aucune demande de remboursement trouvée.
              </td>
            </tr>
            <tr v-for="refund in refunds" :key="refund.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4 font-mono text-xs text-textMuted">#{{ refund.id }}</td>
              <td class="px-6 py-4 font-medium text-text">{{ refund.passenger_name || 'Passager' }}</td>
              <td class="px-6 py-4 text-text">{{ refund.driver_name || 'Conducteur' }}</td>
              <td class="px-6 py-4 font-semibold">{{ refund.amount }} FCFA</td>
              <td class="px-6 py-4 text-textMuted max-w-[200px] truncate" :title="refund.reason">{{ refund.reason }}</td>
              <td class="px-6 py-4">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-warning/10 text-warningDark': refund.status === 'pending',
                    'bg-success/10 text-success': refund.status === 'approved',
                    'bg-error/10 text-error': refund.status === 'rejected',
                  }"
                >
                  {{ getStatusLabel(refund.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right space-x-2">
                <template v-if="refund.status === 'pending'">
                  <button
                    @click="processRefund(refund.id, 'approve')"
                    class="p-2 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-colors"
                    title="Approuver le remboursement"
                  >
                    <Icon name="ph:check" class="w-4 h-4" />
                  </button>
                  <button
                    @click="processRefund(refund.id, 'reject')"
                    class="p-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-lg transition-colors"
                    title="Refuser le remboursement"
                  >
                    <Icon name="ph:x" class="w-4 h-4" />
                  </button>
                </template>
                <template v-else>
                  <span class="text-xs text-textLight italic">Traité</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { fetchApi } = useApi()

const refunds = ref<any[]>([])
const loading = ref(false)

onMounted(() => {
  fetchRefunds()
})

async function fetchRefunds() {
  loading.value = true
  try {
    const data = await fetchApi('/refund-requests/')
    refunds.value = Array.isArray(data) ? data : data.results || []
  } catch (error) {
    console.error('Erreur lors de la récupération des remboursements:', error)
  } finally {
    loading.value = false
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending': return 'En attente'
    case 'approved': return 'Approuvé'
    case 'rejected': return 'Refusé'
    default: return status
  }
}

async function processRefund(id: number, action: 'approve' | 'reject') {
  if (!confirm(`Voulez-vous vraiment ${action === 'approve' ? 'approuver' : 'refuser'} cette demande ?`)) return
  
  try {
    await fetchApi(`/refund-requests/${id}/${action}/`, { method: 'POST' })
    alert(`La demande a été ${action === 'approve' ? 'approuvée' : 'refusée'}.`)
    await fetchRefunds()
  } catch (err: any) {
    alert("Erreur lors du traitement : " + (err.message || ''))
  }
}
</script>
