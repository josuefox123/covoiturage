<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy - Gestion des versements (Payouts) conducteurs.

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
    <div v-if="actionModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-xs" @click="closeActionModal"></div>
      <div class="bg-card rounded-xl border border-border overflow-hidden shadow-xl max-w-md w-full z-10 relative p-6 space-y-4">
        <h3 class="text-lg font-bold text-text">
          {{ actionModal.action === "approve" ? "Confirmer le versement" : "Rejeter la demande" }}
        </h3>
        <p class="text-textMuted text-sm">
          {{ actionModal.action === "approve" 
            ? `Vous confirmez avoir verse la somme de ${actionModal.payout?.amount} FCFA au conducteur ${actionModal.payout?.driver_name} sur le numero Mobile Money ${actionModal.payout?.phone_number} ?`
            : `Vous allez rejeter la demande de versement de ${actionModal.payout?.amount} FCFA du conducteur ${actionModal.payout?.driver_name}.` }}
        </p>

        <!-- Champ note facultatif -->
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-textMuted uppercase tracking-wider">Note ou Reference de transaction</label>
          <input
            v-model="actionModal.adminNote"
            type="text"
            placeholder="Ex: Ref MTN 483758392"
            class="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-sm text-text focus:outline-none focus:border-primary"
          />
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="closeActionModal" class="px-4 py-2 border border-border rounded-lg text-textMuted text-sm font-medium hover:bg-background transition-colors">
            Annuler
          </button>
          <button 
            @click="handleConfirmAction" 
            :disabled="actionModal.submitting"
            class="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            :class="actionModal.action === 'approve' ? 'bg-success hover:bg-success-dark' : 'bg-error hover:bg-error-dark'"
          >
            <Icon v-if="actionModal.submitting" name="ph:spinner-gap" class="w-4 h-4 animate-spin" />
            <span>{{ actionModal.action === 'approve' ? 'Oui, confirmer le virement' : 'Oui, rejeter' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">Demandes de Virement Conducteur</h1>
        <p class="text-textMuted mt-1">Validez et suivez les demandes de reversement des conducteurs.</p>
      </div>
      <button @click="fetchPayouts" class="p-2 bg-card border border-border rounded-lg text-textLight hover:text-primary transition-colors w-fit self-start sm:self-auto" title="Actualiser">
        <Icon name="ph:arrows-clockwise" class="w-5 h-5" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Filtres statut -->
    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
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
          {{ payouts.filter(p => p.status === s.value).length }}
        </span>
      </button>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-gray-50/50 border-b border-border text-textMuted font-semibold">
            <tr>
              <th class="px-6 py-4">Conducteur</th>
              <th class="px-6 py-4">Trajet / Date</th>
              <th class="px-6 py-4">Montant</th>
              <th class="px-6 py-4">Mobile Money</th>
              <th class="px-6 py-4">Statut</th>
              <th class="px-6 py-4">Date de demande</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="loading && payouts.length === 0">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <Icon name="ph:spinner-gap" class="w-8 h-8 text-primary animate-spin" />
                  <p class="text-textMuted text-sm">Chargement des demandes de virement...</p>
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredPayouts.length === 0">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <div class="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                    <Icon name="ph:cash" class="w-7 h-7 text-textMuted" />
                  </div>
                  <p class="text-text font-medium">Aucune demande trouvee</p>
                  <p class="text-textMuted text-sm">Aucune demande de reversement pour ce filtre.</p>
                </div>
              </td>
            </tr>
            <tr v-for="payout in filteredPayouts" :key="payout.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4">
                <div>
                  <p class="font-medium text-text">{{ payout.driver_name || 'Conducteur' }}</p>
                  <p class="text-xs text-textMuted">{{ payout.driver_email }}</p>
                </div>
              </td>
              <td class="px-6 py-4">
                <div>
                  <p class="text-text">{{ payout.ride_route }}</p>
                  <p class="text-xs text-textMuted">Depart le {{ formatDate(payout.ride_date) }}</p>
                </div>
              </td>
              <td class="px-6 py-4 font-semibold text-primary">
                {{ payout.amount.toLocaleString("fr-FR") }} F
              </td>
              <td class="px-6 py-4 font-mono text-text">
                {{ payout.phone_number }}
              </td>
              <td class="px-6 py-4">
                <div>
                  <span
                    class="px-2.5 py-1 rounded-full text-xs font-semibold"
                    :class="{
                      'bg-warning/10 text-warning-dark': payout.status === 'pending',
                      'bg-primary/10 text-primary': payout.status === 'processing',
                      'bg-success/10 text-success': payout.status === 'paid',
                      'bg-error/10 text-error': payout.status === 'failed',
                    }"
                  >
                    {{ getStatusLabel(payout.status) }}
                  </span>
                  <p v-if="payout.admin_note" class="text-xs text-textMuted mt-1 max-w-[180px] truncate" :title="payout.admin_note">
                    Note: {{ payout.admin_note }}
                  </p>
                </div>
              </td>
              <td class="px-6 py-4 text-xs text-textMuted">
                {{ formatDateTime(payout.requested_at) }}
              </td>
              <td class="px-6 py-4 text-right">
                <template v-if="payout.status === 'pending'">
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      @click="openActionModal(payout, 'approve')"
                      class="p-2 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-colors"
                      title="Valider le virement"
                    >
                      <Icon name="ph:check" class="w-4 h-4" />
                    </button>
                    <button
                      @click="openActionModal(payout, 'reject')"
                      class="p-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-lg transition-colors"
                      title="Rejeter le virement"
                    >
                      <Icon name="ph:x" class="w-4 h-4" />
                    </button>
                  </div>
                </template>
                <template v-else-if="payout.status === 'paid'">
                  <span class="text-xs text-success font-medium flex items-center justify-end gap-1">
                    <Icon name="ph:check-circle" class="w-4 h-4" /> Verse
                  </span>
                </template>
                <template v-else>
                  <span class="text-xs text-error font-medium flex items-center justify-end gap-1">
                    <Icon name="ph:x-circle" class="w-4 h-4" /> Echoue
                  </span>
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

const payouts = ref<any[]>([])
const loading = ref(false)
const filterStatus = ref('all')

const statuses = [
  { value: 'all', label: 'Tous', badgeClass: '' },
  { value: 'pending', label: 'En attente', badgeClass: 'bg-warning/20 text-warning-dark' },
  { value: 'paid', label: 'Verses', badgeClass: 'bg-success/20 text-success' },
  { value: 'failed', label: 'Echoues', badgeClass: 'bg-error/20 text-error' },
]

const filteredPayouts = computed(() => {
  if (filterStatus.value === 'all') return payouts.value
  return payouts.value.filter(p => p.status === filterStatus.value)
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

// Action Modal
const actionModal = reactive({
  show: false,
  payout: null as any,
  action: '' as 'approve' | 'reject',
  adminNote: '',
  submitting: false,
})

function openActionModal(payout: any, action: 'approve' | 'reject') {
  actionModal.payout = payout
  actionModal.action = action
  actionModal.adminNote = ''
  actionModal.show = true
}

function closeActionModal() {
  actionModal.show = false
  actionModal.payout = null
}

async function handleConfirmAction() {
  const { payout, action, adminNote } = actionModal
  actionModal.submitting = true

  try {
    const endpoint = `/driver-payouts/${payout.id}/${action}/`
    await fetchApi(endpoint, {
      method: 'POST',
      body: { admin_note: adminNote }
    })
    
    // Update locally
    const idx = payouts.value.findIndex(p => p.id === payout.id)
    if (idx !== -1) {
      payouts.value[idx] = { 
        ...payouts.value[idx], 
        status: action === 'approve' ? 'paid' : 'failed',
        admin_note: adminNote
      }
    }

    showToast(
      'success',
      action === 'approve' ? 'Reversement valide' : 'Demande rejetee',
      action === 'approve'
        ? `Le virement pour le conducteur ${payout.driver_name} a ete marque comme effectue.`
        : `La demande de ${payout.driver_name} a ete rejetee.`
    )
    closeActionModal()
  } catch (err: any) {
    showToast('error', 'Erreur', err?.data?.detail || err.message || 'Erreur lors du traitement.')
  } finally {
    actionModal.submitting = false
  }
}

onMounted(() => {
  fetchPayouts()
})

async function fetchPayouts() {
  loading.value = true
  try {
    const data = await fetchApi('/driver-payouts/')
    payouts.value = Array.isArray(data) ? data : (data as any).results || []
  } catch (error) {
    showToast('error', 'Erreur', 'Impossible de charger les demandes de virement.')
    console.error('Erreur lors du chargement des payouts:', error)
  } finally {
    loading.value = false
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending': return 'En attente'
    case 'processing': return 'Traitement'
    case 'paid': return 'Paye'
    case 'failed': return 'Echoue'
    default: return status
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}
</script>
