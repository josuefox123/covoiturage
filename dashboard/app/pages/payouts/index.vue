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

    <!-- Modal Actions (Approve / Mark Paid / Reject / Retry) -->
    <div v-if="actionModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-xs" @click="closeActionModal"></div>
      <div class="bg-card rounded-xl border border-border overflow-hidden shadow-xl max-w-md w-full z-10 relative p-6 space-y-4">
        <h3 class="text-lg font-bold text-text">
          <span v-if="actionModal.action === 'approve'">Mettre en traitement</span>
          <span v-else-if="actionModal.action === 'mark-paid'">Confirmer le paiement réel</span>
          <span v-else-if="actionModal.action === 'reject'">Rejeter la demande de retrait</span>
          <span v-else-if="actionModal.action === 'retry'">Relancer le versement</span>
        </h3>
        <p class="text-textMuted text-sm">
          <span v-if="actionModal.action === 'approve'">
            Vous allez approuver la demande et la passer en statut <strong>En cours de traitement (processing)</strong> pour le conducteur {{ actionModal.payout?.driver_name }}.
          </span>
          <span v-else-if="actionModal.action === 'mark-paid'">
            Confirmez que vous avez réellement effectué le transfert de <strong>{{ actionModal.payout?.amount }} FCFA</strong> vers {{ actionModal.payout?.phone_number }}.
          </span>
          <span v-else-if="actionModal.action === 'reject'">
            Vous allez rejeter la demande de {{ actionModal.payout?.amount }} FCFA. Le montant sera immédiatement recrédité sur le solde disponible du conducteur.
          </span>
          <span v-else-if="actionModal.action === 'retry'">
            Voulez-vous relancer cette demande de versement échouée de {{ actionModal.payout?.amount }} FCFA ?
          </span>
        </p>

        <!-- Saisie Référence / Motif -->
        <div class="space-y-2">
          <!-- Si Rejet : motif obligatoire -->
          <div v-if="actionModal.action === 'reject'" class="space-y-1">
            <label class="text-xs font-semibold text-textMuted uppercase tracking-wider">Motif du rejet (obligatoire)</label>
            <input
              v-model="actionModal.adminNote"
              type="text"
              placeholder="Ex: Numéro non attribué ou invalide"
              class="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-sm text-text focus:outline-none focus:border-primary"
              required
            />
          </div>

          <!-- Si Mark Paid : référence de virement optionnelle/recommandée -->
          <div v-else-if="actionModal.action === 'mark-paid'" class="space-y-1">
            <label class="text-xs font-semibold text-textMuted uppercase tracking-wider">Référence de transaction (Ex: FeexPay, MTN, Moov)</label>
            <input
              v-model="actionModal.feexpayRef"
              type="text"
              placeholder="Ex: FXP-483758392"
              class="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-sm text-text focus:outline-none focus:border-primary"
            />
            <label class="text-xs font-semibold text-textMuted uppercase tracking-wider block mt-2">Note administrative (optionnel)</label>
            <input
              v-model="actionModal.adminNote"
              type="text"
              placeholder="Ex: Effectué via portail MTN"
              class="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-sm text-text focus:outline-none focus:border-primary"
            />
          </div>

          <!-- Si Approve ou Retry -->
          <div v-else class="space-y-1">
            <label class="text-xs font-semibold text-textMuted uppercase tracking-wider">Note ou commentaire (optionnel)</label>
            <input
              v-model="actionModal.adminNote"
              type="text"
              placeholder="Ex: Traitement en cours..."
              class="w-full px-3.5 py-2 border border-border rounded-lg bg-background text-sm text-text focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="closeActionModal" class="px-4 py-2 border border-border rounded-lg text-textMuted text-sm font-medium hover:bg-background transition-colors">
            Annuler
          </button>
          <button 
            @click="handleConfirmAction" 
            :disabled="actionModal.submitting || (actionModal.action === 'reject' && !actionModal.adminNote.trim())"
            class="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            :class="{
              'bg-primary hover:bg-primary-dark': actionModal.action === 'approve' || actionModal.action === 'retry',
              'bg-success hover:bg-success-dark': actionModal.action === 'mark-paid',
              'bg-error hover:bg-error-dark': actionModal.action === 'reject'
            }"
          >
            <Icon v-if="actionModal.submitting" name="ph:spinner-gap" class="w-4 h-4 animate-spin" />
            <span>
              <span v-if="actionModal.action === 'approve'">Confirmer la mise en traitement</span>
              <span v-else-if="actionModal.action === 'mark-paid'">Confirmer le virement</span>
              <span v-else-if="actionModal.action === 'reject'">Confirmer le rejet</span>
              <span v-else-if="actionModal.action === 'retry'">Relancer</span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">Demandes de Virement Conducteur</h1>
        <p class="text-textMuted mt-1">Gérez le workflow financier de reversement (MTN / Moov / Celtiis).</p>
      </div>
      <button @click="fetchPayouts" class="p-2 bg-card border border-border rounded-lg text-textLight hover:text-primary transition-colors w-fit self-start sm:self-auto" title="Actualiser">
        <Icon name="ph:arrows-clockwise" class="w-5 h-5" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Stats Cards Summary (Appel direct aux stats du backend) -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <div class="bg-card border border-border p-4 rounded-xl shadow-xs">
        <p class="text-xs text-textMuted uppercase font-semibold">En attente (pending)</p>
        <p class="text-2xl font-bold text-warning mt-1">{{ stats.amounts.pending.toLocaleString() }} F</p>
      </div>
      <div class="bg-card border border-border p-4 rounded-xl shadow-xs">
        <p class="text-xs text-textMuted uppercase font-semibold">En cours (processing)</p>
        <p class="text-2xl font-bold text-blue-500 mt-1">{{ stats.amounts.processing.toLocaleString() }} F</p>
      </div>
      <div class="bg-card border border-border p-4 rounded-xl shadow-xs">
        <p class="text-xs text-textMuted uppercase font-semibold">Déjà versés (paid)</p>
        <p class="text-2xl font-bold text-success mt-1">{{ stats.amounts.paid.toLocaleString() }} F</p>
      </div>
      <div class="bg-card border border-border p-4 rounded-xl shadow-xs">
        <p class="text-xs text-textMuted uppercase font-semibold">Échoués / Refusés (failed)</p>
        <p class="text-2xl font-bold text-error mt-1">{{ stats.amounts.failed.toLocaleString() }} F</p>
      </div>
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
        <span class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
          {{ s.value === 'all' ? payouts.length : payouts.filter(p => p.status === s.value).length }}
        </span>
      </button>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-gray-50/50 border-b border-border text-textMuted font-semibold">
            <tr>
              <th class="px-6 py-4">Référence</th>
              <th class="px-6 py-4">Conducteur</th>
              <th class="px-6 py-4">Montant</th>
              <th class="px-6 py-4">Mobile Money</th>
              <th class="px-6 py-4">Mode</th>
              <th class="px-6 py-4">Statut</th>
              <th class="px-6 py-4">Date de demande</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="loading && payouts.length === 0">
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <Icon name="ph:spinner-gap" class="w-8 h-8 text-primary animate-spin" />
                  <p class="text-textMuted text-sm">Chargement des demandes de virement...</p>
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredPayouts.length === 0">
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <div class="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                    <Icon name="ph:cash" class="w-7 h-7 text-textMuted" />
                  </div>
                  <p class="text-text font-medium">Aucune demande trouvée</p>
                  <p class="text-textMuted text-sm">Aucune demande de reversement pour ce filtre.</p>
                </div>
              </td>
            </tr>
            <tr v-for="payout in filteredPayouts" :key="payout.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4 font-mono font-bold text-xs text-text">
                {{ payout.payout_reference }}
              </td>
              <td class="px-6 py-4">
                <div>
                  <p class="font-medium text-text">{{ payout.driver_name || 'Conducteur' }}</p>
                  <p class="text-xs text-textMuted">{{ payout.driver_phone || payout.driver_email }}</p>
                </div>
              </td>
              <td class="px-6 py-4 font-semibold text-primary">
                {{ payout.amount.toLocaleString("fr-FR") }} F
              </td>
              <td class="px-6 py-4 text-text">
                <div>
                  <span class="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 mr-1.5 uppercase text-gray-700">
                    {{ payout.operator }}
                  </span>
                  <span class="font-mono">{{ payout.phone_number }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-xs">
                <span class="font-semibold" :class="payout.payment_mode === 'automatic' ? 'text-primary' : 'text-textLight'">
                  {{ payout.payment_mode === 'automatic' ? '⚡ Auto' : '👤 Manuel' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div>
                  <span
                    class="px-2.5 py-1 rounded-full text-xs font-semibold"
                    :class="{
                      'bg-warning/10 text-warning-dark': payout.status === 'pending',
                      'bg-blue-500/10 text-blue-600': payout.status === 'processing',
                      'bg-success/10 text-success': payout.status === 'paid',
                      'bg-error/10 text-error': payout.status === 'failed',
                      'bg-gray-100 text-gray-500': payout.status === 'cancelled',
                    }"
                  >
                    {{ getStatusLabel(payout.status) }}
                  </span>
                  <p v-if="payout.feexpay_reference" class="text-xs text-primary font-mono mt-1" :title="payout.feexpay_reference">
                    Réf FeexPay: {{ payout.feexpay_reference }}
                  </p>
                  <p v-if="payout.admin_note" class="text-xs text-textMuted mt-1 max-w-[200px] truncate" :title="payout.admin_note">
                    Note: {{ payout.admin_note }}
                  </p>
                  <p v-if="payout.failure_reason" class="text-xs text-error mt-0.5 max-w-[200px] truncate" :title="payout.failure_reason">
                    Erreur: {{ payout.failure_reason }}
                  </p>
                </div>
              </td>
              <td class="px-6 py-4 text-xs text-textMuted">
                {{ formatDateTime(payout.requested_at) }}
              </td>
              <td class="px-6 py-4 text-right">
                <!-- ACTIONS PENDING (En attente) : Approuver (mettre en processing) / Rejeter -->
                <template v-if="payout.status === 'pending'">
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      @click="openActionModal(payout, 'approve')"
                      class="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors"
                      title="Mettre en traitement"
                    >
                      <Icon name="ph:check" class="w-4 h-4" />
                    </button>
                    <button
                      @click="openActionModal(payout, 'reject')"
                      class="p-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-lg transition-colors"
                      title="Rejeter la demande"
                    >
                      <Icon name="ph:x" class="w-4 h-4" />
                    </button>
                  </div>
                </template>

                <!-- ACTIONS PROCESSING (En cours) : Confirmer virement (mark-paid) / Rejeter -->
                <template v-else-if="payout.status === 'processing'">
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      @click="openActionModal(payout, 'mark-paid')"
                      class="px-2.5 py-1.5 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                      title="Valider le virement effectué"
                    >
                      <Icon name="ph:check-square" class="w-3.5 h-3.5" /> Marquer Payé
                    </button>
                    <button
                      @click="openActionModal(payout, 'reject')"
                      class="p-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-lg transition-colors"
                      title="Rejeter / Annuler"
                    >
                      <Icon name="ph:x" class="w-4 h-4" />
                    </button>
                  </div>
                </template>

                <!-- ACTIONS FAILED (Échoué) : Relancer (retry) -->
                <template v-else-if="payout.status === 'failed'">
                  <button
                    @click="openActionModal(payout, 'retry')"
                    class="px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                    title="Relancer le reversement"
                  >
                    <Icon name="ph:arrow-clockwise" class="w-3.5 h-3.5" /> Relancer
                  </button>
                </template>

                <!-- ACTIONS PAID (Versé) : Badge final -->
                <template v-else-if="payout.status === 'paid'">
                  <span class="text-xs text-success font-medium flex items-center justify-end gap-1">
                    <Icon name="ph:check-circle" class="w-4 h-4" /> Versé
                  </span>
                </template>
                <template v-else>
                  <span class="text-xs text-textMuted font-medium flex items-center justify-end gap-1">
                    Annulé
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
  { value: 'processing', label: 'En traitement', badgeClass: 'bg-blue-500/20 text-blue-600' },
  { value: 'paid', label: 'Versés', badgeClass: 'bg-success/20 text-success' },
  { value: 'failed', label: 'Échoués', badgeClass: 'bg-error/20 text-error' },
]

const stats = reactive({
  amounts: {
    pending: 0,
    processing: 0,
    paid: 0,
    failed: 0,
  }
})

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
  action: '' as 'approve' | 'mark-paid' | 'reject' | 'retry',
  adminNote: '',
  feexpayRef: '',
  submitting: false,
})

function openActionModal(payout: any, action: 'approve' | 'mark-paid' | 'reject' | 'retry') {
  actionModal.payout = payout
  actionModal.action = action
  actionModal.adminNote = ''
  actionModal.feexpayRef = ''
  actionModal.show = true
}

function closeActionModal() {
  actionModal.show = false
  actionModal.payout = null
}

async function handleConfirmAction() {
  const { payout, action, adminNote, feexpayRef } = actionModal
  actionModal.submitting = true

  try {
    const endpoint = `/driver-payouts/${payout.id}/${action}/`
    const body: any = { admin_note: adminNote }
    if (action === 'mark-paid' && feexpayRef) {
      body.feexpay_reference = feexpayRef
    }

    await fetchApi(endpoint, {
      method: 'POST',
      body
    })
    
    // Mettre à jour localement ou rafraîchir
    fetchPayouts()

    showToast(
      'success',
      action === 'approve' ? 'Mise en traitement effectuée' :
      action === 'mark-paid' ? 'Reversement confirmé' :
      action === 'reject' ? 'Demande rejetée' : 'Virement relancé',
      `L'opération pour le conducteur ${payout.driver_name} a été enregistrée avec succès.`
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
    
    // Charger également les statistiques financières globales
    const statsData = await fetchApi('/driver-payouts/stats/')
    if (statsData && statsData.amounts) {
      stats.amounts = statsData.amounts
    }
  } catch (error) {
    showToast('error', 'Erreur', 'Impossible de charger les données financières.')
    console.error('Erreur lors du chargement des payouts:', error)
  } finally {
    loading.value = false
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending': return 'En attente'
    case 'processing': return 'En traitement'
    case 'paid': return 'Payé'
    case 'failed': return 'Échoué'
    case 'cancelled': return 'Annulé'
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
