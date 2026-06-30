<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy - Gestion des remboursements.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="space-y-6">
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <!-- Modal Confirmer Approuver/Refuser -->
    <AlertModal
      :show="actionModal.show"
      :type="actionModal.action === 'approve' ? 'warning' : 'danger'"
      :title="actionModal.action === 'approve' ? 'Approuver ce remboursement ?' : 'Refuser ce remboursement ?'"
      :message="actionModal.action === 'approve'
        ? `Vous allez approuver la demande de remboursement de ${actionModal.refund?.passenger_name || 'ce passager'} (${actionModal.refund?.amount} FCFA).`
        : `Vous allez refuser la demande de remboursement de ${actionModal.refund?.passenger_name || 'ce passager'}.`"
      :confirm-text="actionModal.action === 'approve' ? 'Oui, approuver' : 'Oui, refuser'"
      cancel-text="Annuler"
      :show-cancel="true"
      @close="actionModal.show = false"
      @confirm="handleConfirmAction"
    />

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-text">Demandes de Remboursement</h1>
        <p class="text-textMuted mt-1">Gérez les demandes d'annulation et de remboursement des passagers.</p>
      </div>
      <button @click="fetchRefunds" class="p-2 bg-card border border-border rounded-lg text-textLight hover:text-primary transition-colors" title="Actualiser">
        <Icon name="ph:arrows-clockwise" class="w-5 h-5" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Filtres statut -->
    <div class="flex items-center gap-3">
      <button
        v-for="s in statuses"
        :key="s.value"
        @click="filterStatus = s.value"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="filterStatus === s.value
          ? 'bg-primary/10 border-primary/20 text-primary'
          : 'bg-card border-border text-textMuted hover:text-text'"
      >
        {{ s.label }}
        <span v-if="s.value !== 'all'" class="ml-1 px-1.5 py-0.5 text-xs rounded-full" :class="s.badgeClass">
          {{ refunds.filter(r => r.status === s.value).length }}
        </span>
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
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <Icon name="ph:spinner-gap" class="w-8 h-8 text-primary animate-spin" />
                  <p class="text-textMuted text-sm">Chargement des remboursements...</p>
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredRefunds.length === 0">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <div class="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                    <Icon name="ph:receipt-x" class="w-7 h-7 text-textMuted" />
                  </div>
                  <p class="text-text font-medium">Aucune demande trouvée</p>
                  <p class="text-textMuted text-sm">Aucune demande de remboursement pour ce filtre.</p>
                </div>
              </td>
            </tr>
            <tr v-for="refund in filteredRefunds" :key="refund.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4 font-mono text-xs text-textMuted">#{{ refund.id }}</td>
              <td class="px-6 py-4 font-medium text-text">{{ refund.passenger_name || 'Passager' }}</td>
              <td class="px-6 py-4 text-text">{{ refund.driver_name || 'Conducteur' }}</td>
              <td class="px-6 py-4 font-semibold text-primary">{{ refund.amount }} FCFA</td>
              <td class="px-6 py-4 text-textMuted max-w-[200px] truncate" :title="refund.reason">{{ refund.reason }}</td>
              <td class="px-6 py-4">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-warning/10 text-warning-dark': refund.status === 'pending',
                    'bg-success/10 text-success': refund.status === 'approved',
                    'bg-error/10 text-error': refund.status === 'rejected',
                  }"
                >
                  {{ getStatusLabel(refund.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <template v-if="refund.status === 'pending'">
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      @click="openActionModal(refund, 'approve')"
                      class="p-2 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-colors"
                      title="Approuver le remboursement"
                    >
                      <Icon name="ph:check" class="w-4 h-4" />
                    </button>
                    <button
                      @click="openActionModal(refund, 'reject')"
                      class="p-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-lg transition-colors"
                      title="Refuser le remboursement"
                    >
                      <Icon name="ph:x" class="w-4 h-4" />
                    </button>
                  </div>
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
import { ref, computed, onMounted, reactive } from 'vue'

const { fetchApi } = useApi()

const refunds = ref<any[]>([])
const loading = ref(false)
const filterStatus = ref('all')

const statuses = [
  { value: 'all', label: 'Tous', badgeClass: '' },
  { value: 'pending', label: 'En attente', badgeClass: 'bg-warning/20 text-warning-dark' },
  { value: 'approved', label: 'Approuvés', badgeClass: 'bg-success/20 text-success' },
  { value: 'rejected', label: 'Refusés', badgeClass: 'bg-error/20 text-error' },
]

const filteredRefunds = computed(() => {
  if (filterStatus.value === 'all') return refunds.value
  return refunds.value.filter(r => r.status === filterStatus.value)
})

// Toast
const toast = reactive({
  show: false,
  type: 'success' as 'success' | 'error' | 'warning' | 'info',
  title: '',
  message: '',
})
function showToast(type: typeof toast.type, title: string, message = '') {
  toast.type = type
  toast.title = title
  toast.message = message
  toast.show = true
}

// Action Modal (Approuver / Refuser)
const actionModal = reactive({
  show: false,
  refund: null as any,
  action: '' as 'approve' | 'reject',
})

function openActionModal(refund: any, action: 'approve' | 'reject') {
  actionModal.refund = refund
  actionModal.action = action
  actionModal.show = true
}

async function handleConfirmAction() {
  const { refund, action } = actionModal
  actionModal.show = false

  try {
    await fetchApi(`/refund-requests/${refund.id}/${action}/`, { method: 'POST' })
    // Update locally
    const idx = refunds.value.findIndex(r => r.id === refund.id)
    if (idx !== -1) {
      refunds.value[idx] = { ...refunds.value[idx], status: action === 'approve' ? 'approved' : 'rejected' }
    }
    showToast(
      'success',
      action === 'approve' ? 'Remboursement approuvé' : 'Demande refusée',
      action === 'approve'
        ? `La demande de ${refund.passenger_name || 'ce passager'} a été approuvée.`
        : `La demande de ${refund.passenger_name || 'ce passager'} a été refusée.`
    )
  } catch (err: any) {
    showToast('error', 'Erreur', err?.data?.detail || err.message || 'Erreur lors du traitement.')
  }
}

onMounted(() => {
  fetchRefunds()
})

async function fetchRefunds() {
  loading.value = true
  try {
    const data = await fetchApi('/refund-requests/')
    refunds.value = Array.isArray(data) ? data : (data as any).results || []
  } catch (error) {
    showToast('error', 'Erreur', 'Impossible de charger les demandes de remboursement.')
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
</script>
