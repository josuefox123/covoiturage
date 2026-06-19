<template>
  <div>
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <div class="flex items-center gap-4 mb-6">
      <NuxtLink to="/verifications" class="p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
      </NuxtLink>
      <h1 class="text-2xl font-bold text-text">Détail de la vérification</h1>
    </div>

    <div v-if="pending" class="flex justify-center p-12">
      <svg class="w-8 h-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </div>

    <div v-else-if="req" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- User Info Card -->
      <div class="bg-card rounded-xl p-6 border border-border shadow-sm">
        <div class="flex flex-col items-center text-center mb-6">
          <img :src="req.user_details.avatar || '/images/default-avatar.png'" class="w-24 h-24 rounded-full object-cover border-4 border-background shadow-sm mb-4" />
          <h2 class="text-xl font-bold text-text">{{ req.user_details.full_name || 'Utilisateur inconnu' }}</h2>
          <p class="text-textMuted">{{ req.user_details.phone }}</p>
          <div class="mt-4">
            <span
              class="px-3 py-1 rounded-full text-sm font-semibold"
              :class="{
                'bg-warning/10 text-warning': req.status === 'pending',
                'bg-success/10 text-success': req.status === 'approved',
                'bg-error/10 text-error': req.status === 'rejected'
              }"
            >
              {{
                req.status === 'pending' ? '⏳ En attente' :
                req.status === 'approved' ? '✅ Approuvée' : '❌ Rejetée'
              }}
            </span>
          </div>
        </div>

        <div class="space-y-4 border-t border-border pt-4">
          <div class="flex justify-between">
            <span class="text-textMuted text-sm">Date de soumission</span>
            <span class="text-text text-sm font-medium">{{ new Date(req.created_at).toLocaleDateString('fr-FR') }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-textMuted text-sm">ID Demande</span>
            <span class="text-text text-sm font-medium">{{ req.id.split('-')[0] }}...</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="req.status === 'pending'" class="mt-8 flex flex-col gap-3">
          <button
            @click="showApproveModal = true"
            :disabled="actionPending"
            class="w-full flex items-center justify-center gap-2 py-3 bg-success hover:bg-success/90 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            Approuver et Vérifier
          </button>

          <button
            @click="showRejectModal = true"
            :disabled="actionPending"
            class="w-full flex items-center justify-center gap-2 py-3 bg-error/10 hover:bg-error/20 text-error rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            Rejeter
          </button>
        </div>

        <!-- Already processed -->
        <div v-else class="mt-8 p-4 rounded-xl text-center" :class="req.status === 'approved' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'">
          <div class="flex justify-center mb-2">
            <svg v-if="req.status === 'approved'" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            <svg v-else class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          </div>
          <p class="text-sm font-semibold">
            {{ req.status === 'approved' ? 'Demande déjà approuvée' : 'Demande déjà rejetée' }}
          </p>
        </div>
      </div>

      <!-- Documents Card -->
      <div class="lg:col-span-2 bg-card rounded-xl p-6 border border-border shadow-sm">
        <h3 class="text-lg font-bold text-text mb-6">Documents fournis</h3>

        <div class="space-y-8">
          <!-- Selfie -->
          <div>
            <h4 class="text-sm font-semibold text-textMuted uppercase tracking-wider mb-3">Selfie</h4>
            <div class="bg-background rounded-lg border border-border overflow-hidden p-2">
              <img :src="req.selfie" class="w-full max-h-96 object-contain rounded-md bg-black/5" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- CNI Recto -->
            <div>
              <h4 class="text-sm font-semibold text-textMuted uppercase tracking-wider mb-3">Pièce d'identité (Recto)</h4>
              <div class="bg-background rounded-lg border border-border overflow-hidden p-2">
                <img :src="req.id_front" class="w-full h-48 object-contain rounded-md bg-black/5" />
              </div>
            </div>

            <!-- CNI Verso -->
            <div>
              <h4 class="text-sm font-semibold text-textMuted uppercase tracking-wider mb-3">Pièce d'identité (Verso)</h4>
              <div class="bg-background rounded-lg border border-border overflow-hidden p-2">
                <img :src="req.id_back" class="w-full h-48 object-contain rounded-md bg-black/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modale Approuver ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showApproveModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-text">Approuver la demande</h3>
                <p class="text-sm text-textMuted">Le compte sera marqué comme vérifié</p>
              </div>
            </div>

            <div class="mb-5">
              <label class="block text-sm font-semibold text-text mb-2">
                Motif / Message pour le client <span class="text-textMuted font-normal">(optionnel)</span>
              </label>
              <textarea
                v-model="approveMotif"
                rows="3"
                placeholder="Ex : Documents conformes, identité vérifiée avec succès..."
                class="w-full px-4 py-3 rounded-xl border border-border bg-background text-text placeholder-textMuted text-sm resize-none focus:outline-none focus:ring-2 focus:ring-success/50 focus:border-success transition-all"
              />
            </div>

            <div class="flex gap-3">
              <button
                @click="showApproveModal = false; approveMotif = ''"
                class="flex-1 py-3 rounded-xl border border-border text-textMuted font-semibold hover:bg-background transition-colors"
              >
                Annuler
              </button>
              <button
                @click="approve"
                :disabled="actionPending"
                class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-success hover:bg-success/90 text-white font-semibold transition-colors disabled:opacity-50"
              >
                <svg v-if="actionPending" class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modale Rejeter ───────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-xl bg-error/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-text">Rejeter la demande</h3>
                <p class="text-sm text-textMuted">Le client recevra une notification</p>
              </div>
            </div>

            <div class="mb-5">
              <label class="block text-sm font-semibold text-text mb-2">
                Motif du rejet <span class="text-error">*</span>
              </label>
              <textarea
                v-model="rejectMotif"
                rows="4"
                placeholder="Ex : Photo floue, document expiré, selfie non conforme..."
                class="w-full px-4 py-3 rounded-xl border border-border bg-background text-text placeholder-textMuted text-sm resize-none focus:outline-none focus:ring-2 focus:ring-error/50 focus:border-error transition-all"
                :class="{ 'border-error': rejectError }"
              />
              <p v-if="rejectError" class="text-error text-xs mt-1">{{ rejectError }}</p>
            </div>

            <div class="flex gap-3">
              <button
                @click="showRejectModal = false; rejectMotif = ''; rejectError = ''"
                class="flex-1 py-3 rounded-xl border border-border text-textMuted font-semibold hover:bg-background transition-colors"
              >
                Annuler
              </button>
              <button
                @click="reject"
                :disabled="actionPending"
                class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-error hover:bg-error/90 text-white font-semibold transition-colors disabled:opacity-50"
              >
                <svg v-if="actionPending" class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Rejeter
              </button>
            </div>
          </div>
        </div>
      </div>
      <ToastNotification v-model="toast.show" :type="toast.type" :title="toast.title" :message="toast.message" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const route = useRoute()
const { fetchApi } = useApi()

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })

function showToast(type: string, title: string, msg = '') {
  toast.type = type
  toast.title = title
  toast.message = msg
  toast.show = true
}

const req = ref<any>(null)
const pending = ref(true)
const actionPending = ref(false)

// Modales
const showApproveModal = ref(false)
const showRejectModal = ref(false)
const approveMotif = ref('')
const rejectMotif = ref('')
const rejectError = ref('')

const downloadImage = async (url: string, filename: string) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    showToast('error', 'Erreur', 'Erreur lors du téléchargement de l\'image.')
  }
}

const fetchDetail = async () => {
  pending.value = true
  try {
    const data = await fetchApi(`/verifications/${route.params.id}/`)
    req.value = data
  } catch (error) {
    console.error('Erreur', error)
  } finally {
    pending.value = false
  }
}

const approve = async () => {
  actionPending.value = true
  try {
    await fetchApi(`/verifications/${route.params.id}/approve/`, {
      method: 'POST',
      body: JSON.stringify({ motif: approveMotif.value }),
    })
    showApproveModal.value = false
    approveMotif.value = ''
    showToast('success', 'Succès', 'Demande approuvée avec succès.')
    await fetchDetail()
  } catch (error) {
    console.error(error)
    showToast('error', 'Erreur', 'Une erreur est survenue lors de l\'approbation.')
  } finally {
    actionPending.value = false
  }
}

const reject = async () => {
  if (!rejectMotif.value.trim()) {
    rejectError.value = 'Le motif est obligatoire pour un rejet.'
    return
  }
  rejectError.value = ''
  actionPending.value = true
  try {
    await fetchApi(`/verifications/${route.params.id}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ motif: rejectMotif.value }),
    })
    showRejectModal.value = false
    rejectMotif.value = ''
    showToast('success', 'Succès', 'Demande rejetée.')
    await fetchDetail()
  } catch (error) {
    console.error(error)
    showToast('error', 'Erreur', 'Une erreur est survenue lors du rejet.')
  } finally {
    actionPending.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>
