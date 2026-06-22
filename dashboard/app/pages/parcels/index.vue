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
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <!-- Modal de suppression -->
    <AlertModal
      :show="deleteModal.show"
      type="danger"
      title="Supprimer ce colis ?"
      :message="`Vous allez supprimer le colis de ${deleteModal.parcel?.sender_details?.full_name || 'Inconnu'}.`"
      confirm-text="Oui, supprimer"
      cancel-text="Annuler"
      :show-cancel="true"
      @close="deleteModal.show = false"
      @confirm="confirmDelete"
    />

    <!-- Form Modal (Ajouter / Modifier) -->
    <div v-if="formModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden" @click.stop>
        <div class="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 class="text-lg font-bold text-text">{{ formModal.isEdit ? 'Modifier le colis' : 'Ajouter un colis' }}</h3>
          <button @click="formModal.show = false" class="text-textMuted hover:text-text">
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
        </div>
        <form @submit.prevent="saveParcel" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label class="block text-sm font-medium text-text mb-1">Trajet</label>
            <select v-model="formData.ride" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" :disabled="formModal.isEdit">
              <option value="" disabled>Sélectionner un trajet</option>
              <option v-for="r in rides" :key="r.id" :value="r.id">
                {{ r.departure_location }} -> {{ r.arrival_location }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Description</label>
            <input v-model="formData.description" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Nom du Destinataire</label>
            <input v-model="formData.receiver_name" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Téléphone du Destinataire</label>
            <input v-model="formData.receiver_phone" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Statut</label>
            <select v-model="formData.status" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
              <option value="pending">En attente</option>
              <option value="accepted">Accepté</option>
              <option value="picked_up">Récupéré</option>
              <option value="delivered">Livré</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
          <div class="pt-4 flex justify-end space-x-3">
            <button type="button" @click="formModal.show = false" class="px-4 py-2 border border-border rounded-lg hover:bg-background">Annuler</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark" :disabled="saving">
              <span v-if="saving">Enregistrement...</span>
              <span v-else>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text">Colis Zemy Parcels</h1>
        <p class="text-sm text-textLight mt-0.5">{{ parcels.length }} colis enregistrés</p>
      </div>
      <button @click="openCreateModal" class="inline-flex items-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark shadow-sm">
        <Icon name="ph:plus" class="w-5 h-5 mr-2" />
        Ajouter un colis
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <div class="bg-card p-4 rounded-xl border border-border shadow-sm">
        <p class="text-sm text-textMuted font-medium">Revenus totaux</p>
        <p class="text-2xl font-bold text-text mt-1">{{ stats.totalRevenue.toLocaleString() }} FCFA</p>
      </div>
      <div class="bg-card p-4 rounded-xl border border-border shadow-sm">
        <p class="text-sm text-textMuted font-medium">Commissions Zemy</p>
        <p class="text-2xl font-bold text-primary mt-1">{{ stats.totalCommissions.toLocaleString() }} FCFA</p>
      </div>
      <div class="bg-card p-4 rounded-xl border border-border shadow-sm">
        <p class="text-sm text-textMuted font-medium">En attente</p>
        <p class="text-2xl font-bold text-warning mt-1">{{ stats.pending }}</p>
      </div>
      <div class="bg-card p-4 rounded-xl border border-border shadow-sm">
        <p class="text-sm text-textMuted font-medium">Livrés</p>
        <p class="text-2xl font-bold text-success mt-1">{{ stats.delivered }}</p>
      </div>
      <div class="bg-card p-4 rounded-xl border border-border shadow-sm">
        <p class="text-sm text-textMuted font-medium">Annulés</p>
        <p class="text-2xl font-bold text-error mt-1">{{ stats.cancelled }}</p>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/60 text-textLight">
            <tr>
              <th class="px-5 py-3 font-semibold">Description</th>
              <th class="px-5 py-3 font-semibold">Trajet</th>
              <th class="px-5 py-3 font-semibold">Expéditeur</th>
              <th class="px-5 py-3 font-semibold">Destinataire</th>
              <th class="px-5 py-3 font-semibold">Statut</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending">
              <td colspan="6" class="py-10 text-center text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="parcels.length === 0">
              <td colspan="6" class="py-10 text-center text-textMuted">Aucun colis trouvé.</td>
            </tr>
            <tr v-for="parcel in parcels" :key="parcel.id" class="hover:bg-background/30 transition-colors">
              <td class="px-5 py-4">
                <p class="font-semibold text-text">{{ parcel.description }}</p>
                <p class="text-xs text-textLight">{{ parcel.parcel_type }} - {{ parcel.dimensions }}</p>
              </td>
              <td class="px-5 py-4">
                <p class="text-text">{{ parcel.ride_details?.departure_location }} &rarr; {{ parcel.ride_details?.arrival_location }}</p>
              </td>
              <td class="px-5 py-4 text-text">{{ parcel.sender_details?.full_name || 'Inconnu' }}</td>
              <td class="px-5 py-4 text-text">
                <p>{{ parcel.receiver_name }}</p>
                <p class="text-xs text-textLight">{{ parcel.receiver_phone }}</p>
              </td>
              <td class="px-5 py-4">
                <span 
                  class="px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="{
                    'bg-warning/10 text-warningDark': parcel.status === 'pending' || parcel.status === 'accepted',
                    'bg-primary/10 text-primary': parcel.status === 'picked_up',
                    'bg-success/10 text-success': parcel.status === 'delivered',
                    'bg-error/10 text-error': parcel.status === 'cancelled'
                  }"
                >
                  {{ parcel.status }}
                </span>
              </td>
              <td class="px-5 py-4 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <button @click="openEditModal(parcel)" class="p-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark" title="Modifier">
                    <Icon name="ph:pencil-simple" class="w-5 h-5" />
                  </button>
                  <button @click="openDeleteModal(parcel)" class="p-2 bg-error text-white rounded-lg hover:bg-red-700" title="Supprimer">
                    <Icon name="ph:trash" class="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'

const { fetchApi } = useApi()

const parcels = ref<any[]>([])
const rides = ref<any[]>([])
const pending = ref(true)
const saving = ref(false)

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })
const deleteModal = reactive({ show: false, parcel: null as any })
const formModal = reactive({ show: false, isEdit: false, parcelId: null as any })
const formData = reactive({ ride: '', description: '', receiver_name: '', receiver_phone: '', status: 'pending' })

function showToast(type: string, title: string, msg = '') {
  toast.type = type; toast.title = title; toast.message = msg; toast.show = true
}

const stats = computed(() => {
  let totalRevenue = 0;
  let totalCommissions = 0;
  let pendingCount = 0;
  let deliveredCount = 0;
  let cancelledCount = 0;

  parcels.value.forEach(p => {
    if (p.status !== 'cancelled') {
      totalRevenue += (p.price || 0);
      totalCommissions += (p.zemy_commission || 0);
    }
    if (p.status === 'pending') pendingCount++;
    if (p.status === 'delivered') deliveredCount++;
    if (p.status === 'cancelled') cancelledCount++;
  });

  return { totalRevenue, totalCommissions, pending: pendingCount, delivered: deliveredCount, cancelled: cancelledCount };
});

async function fetchData() {
  pending.value = true
  try {
    const [pRes, rRes] = await Promise.all([
      fetchApi<any>('/parcels/'),
      fetchApi<any>('/rides/')
    ])
    parcels.value = Array.isArray(pRes) ? pRes : pRes.results || []
    rides.value = Array.isArray(rRes) ? rRes : rRes.results || []
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de charger les données.')
  } finally {
    pending.value = false
  }
}

function openCreateModal() {
  formModal.isEdit = false
  formModal.parcelId = null
  formData.ride = ''
  formData.description = ''
  formData.receiver_name = ''
  formData.receiver_phone = ''
  formData.status = 'pending'
  formModal.show = true
}

function openEditModal(p: any) {
  formModal.isEdit = true
  formModal.parcelId = p.id
  formData.ride = p.ride
  formData.description = p.description
  formData.receiver_name = p.receiver_name
  formData.receiver_phone = p.receiver_phone
  formData.status = p.status
  formModal.show = true
}

function openDeleteModal(p: any) {
  deleteModal.parcel = p
  deleteModal.show = true
}

async function saveParcel() {
  saving.value = true
  try {
    const payload = { ...formData }
    if (formModal.isEdit) {
      await fetchApi(`/parcels/${formModal.parcelId}/`, { method: 'PUT', body: payload })
      fetchData() 
      showToast('success', 'Colis modifié')
    } else {
      await fetchApi(`/parcels/`, { method: 'POST', body: payload })
      fetchData()
      showToast('success', 'Colis ajouté')
    }
    formModal.show = false
  } catch (e: any) {
    showToast('error', 'Erreur', e.message || 'Vérifiez les informations saisies.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const p = deleteModal.parcel
  deleteModal.show = false
  try {
    await fetchApi(`/parcels/${p.id}/`, { method: 'DELETE' })
    parcels.value = parcels.value.filter(item => item.id !== p.id)
    showToast('success', 'Colis supprimé')
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de supprimer ce colis.')
  }
}

onMounted(fetchData)
</script>
