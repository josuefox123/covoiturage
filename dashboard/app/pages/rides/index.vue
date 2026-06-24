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
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <AlertModal
      :show="deleteModal.show"
      type="danger"
      title="Supprimer ce trajet ?"
      :message="`Vous allez supprimer le trajet ${deleteModal.ride?.departure_location} - ${deleteModal.ride?.arrival_location}.`"
      confirm-text="Oui, supprimer"
      cancel-text="Annuler"
      :show-cancel="true"
      @close="deleteModal.show = false"
      @confirm="confirmDelete"
    />

    <div v-if="formModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div class="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden my-8" @click.stop>
        <div class="px-6 py-4 border-b border-border flex justify-between items-center bg-background">
          <h3 class="text-lg font-bold text-text">{{ formModal.isEdit ? 'Modifier le trajet' : 'Ajouter un trajet' }}</h3>
          <button @click="formModal.show = false" class="text-textMuted hover:text-text">
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
        </div>
        <form @submit.prevent="saveRide" class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-text mb-1">Conducteur</label>
              <select v-model="formData.driver" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" :disabled="formModal.isEdit">
                <option value="" disabled>Sélectionner</option>
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name || u.phone }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Véhicule</label>
              <select v-model="formData.vehicle" class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
                <option value="">Aucun</option>
                <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.brand_model }} - {{ v.license_plate }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Départ</label>
              <input v-model="formData.departure_location" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Arrivée</label>
              <input v-model="formData.arrival_location" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Date</label>
              <input v-model="formData.departure_date" type="date" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Heure</label>
              <input v-model="formData.departure_time" type="time" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Prix (FCFA)</label>
              <input v-model="formData.price_per_seat" type="number" min="0" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Places totales</label>
              <input v-model="formData.total_seats" type="number" min="1" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Places dispo</label>
              <input v-model="formData.seats_available" type="number" min="0" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-1">Statut</label>
              <select v-model="formData.status" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
                <option value="active">Actif</option>
                <option value="completed">Terminé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-text mb-1">Description (optionnel)</label>
              <textarea v-model="formData.description" rows="3" placeholder="Ex: Voyage tranquille..." class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:outline-none"></textarea>
            </div>
          </div>
          <div class="pt-6 flex justify-end space-x-3 border-t border-border mt-6">
            <button type="button" @click="formModal.show = false" class="px-4 py-2 border border-border rounded-lg hover:bg-background">Annuler</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark" :disabled="saving">
              <span v-if="saving">Enregistrement...</span>
              <span v-else>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-text">Trajets</h1>
      <button @click="openCreateModal" class="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors flex items-center">
        <Icon name="ph:plus" class="mr-2" />
        Ajouter
      </button>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <div class="flex space-x-2">
          <select v-model="statusFilter" class="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="archived">Archivé</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
        <div class="relative w-64">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
          <input 
            type="text" 
            placeholder="Rechercher une ville..." 
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          >
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/50 text-textLight">
            <tr>
              <th class="px-6 py-3 font-semibold">Itinéraire</th>
              <th class="px-6 py-3 font-semibold">Date & Heure</th>
              <th class="px-6 py-3 font-semibold">Places</th>
              <th class="px-6 py-3 font-semibold">Prix</th>
              <th class="px-6 py-3 font-semibold">Statut</th>
              <th class="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending" class="text-center py-10">
              <td colspan="6" class="py-10 text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="filteredRides.length === 0" class="text-center py-10">
              <td colspan="6" class="py-10 text-textMuted">Aucun trajet trouvé.</td>
            </tr>
            <tr v-for="ride in filteredRides" :key="ride.id" class="hover:bg-background/30 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center space-x-2">
                  <div class="flex flex-col items-center mr-2">
                    <div class="w-2 h-2 rounded-full bg-primary"></div>
                    <div class="w-0.5 h-3 bg-border my-0.5"></div>
                    <div class="w-2 h-2 rounded-full bg-secondary"></div>
                  </div>
                  <div>
                    <p class="font-bold text-text">{{ ride.departure_location }}</p>
                    <p class="font-bold text-text">{{ ride.arrival_location }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <p class="text-text font-medium">{{ new Date(ride.departure_date).toLocaleDateString('fr-FR') }}</p>
                <p class="text-xs text-textLight">{{ ride.departure_time?.substring(0, 5) }}</p>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center text-text">
                  <Icon name="ph:users" class="mr-1 text-textMuted" />
                  {{ ride.seats_available }} / {{ ride.total_seats }}
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="font-bold text-primary">{{ ride.price_per_seat }} FCFA</span>
              </td>
              <td class="px-6 py-4">
                <span 
                  class="px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="{
                    'bg-success/10 text-success': getDisplayStatus(ride) === 'Actif',
                    'bg-warning/10 text-warningDark': getDisplayStatus(ride) === 'Archivé',
                    'bg-textLight/10 text-textLight': getDisplayStatus(ride) === 'Terminé',
                    'bg-error/10 text-error': getDisplayStatus(ride) === 'Annulé'
                  }"
                >
                  {{ getDisplayStatus(ride) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <button @click="openEditModal(ride)" class="p-2 bg-secondary text-white shadow-sm hover:bg-secondary-dark rounded-lg transition-colors flex items-center justify-center" title="Modifier">
                    <Icon name="ph:pencil-simple" class="w-5 h-5" />
                  </button>
                  <button @click="openDeleteModal(ride)" class="p-2 bg-error text-white shadow-sm hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center" title="Supprimer">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="p-4 border-t border-border flex items-center justify-between text-sm text-textLight">
        <span>Affichage de {{ filteredRides.length }} résultats</span>
        <div class="flex space-x-1">
          <button class="px-3 py-1 rounded-md border border-border hover:bg-background disabled:opacity-50" disabled>Précédent</button>
          <button class="px-3 py-1 rounded-md border border-border hover:bg-background">Suivant</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'

const { fetchApi } = useApi()
const rides = ref<any[]>([])
const users = ref<any[]>([])
const vehicles = ref<any[]>([])
const pending = ref(true)
const saving = ref(false)
const statusFilter = ref('all')

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })
const deleteModal = reactive({ show: false, ride: null as any })
const formModal = reactive({ show: false, isEdit: false, rideId: null as any })

const formData = reactive({
  driver: '', vehicle: '', departure_location: '', arrival_location: '',
  departure_date: '', departure_time: '', price_per_seat: 0,
  total_seats: 4, seats_available: 4, status: 'active', description: ''
})

function showToast(type: string, title: string, msg = '') {
  toast.type = type; toast.title = title; toast.message = msg; toast.show = true
}

const getDisplayStatus = (ride: any) => {
  if (ride.status === 'cancelled') return 'Annulé'
  if (ride.status === 'completed') return 'Terminé'
  const today = new Date()
  today.setHours(0,0,0,0)
  const rideDate = new Date(ride.departure_date)
  rideDate.setHours(0,0,0,0)
  if (rideDate < today) return 'Archivé'
  return 'Actif'
}

const filteredRides = computed(() => {
  if (statusFilter.value === 'all') return rides.value
  
  return rides.value.filter(ride => {
    const status = getDisplayStatus(ride)
    if (statusFilter.value === 'active') return status === 'Actif'
    if (statusFilter.value === 'archived') return status === 'Archivé'
    if (statusFilter.value === 'completed') return status === 'Terminé'
    if (statusFilter.value === 'cancelled') return status === 'Annulé'
    return true
  })
})

async function fetchData() {
  pending.value = true
  try {
    const [rRes, uRes, vRes] = await Promise.all([
      fetchApi<any>('/rides/'),
      fetchApi<any>('/users/'),
      fetchApi<any>('/vehicles/')
    ])
    rides.value = Array.isArray(rRes) ? rRes : rRes.results || []
    users.value = Array.isArray(uRes) ? uRes : uRes.results || []
    vehicles.value = Array.isArray(vRes) ? vRes : vRes.results || []
  } catch (err) {
    showToast('error', 'Erreur', 'Impossible de charger les trajets.')
  } finally {
    pending.value = false
  }
}

function openCreateModal() {
  formModal.isEdit = false
  formModal.rideId = null
  Object.assign(formData, {
    driver: '', vehicle: '', departure_location: '', arrival_location: '',
    departure_date: '', departure_time: '', price_per_seat: 0,
    total_seats: 4, seats_available: 4, status: 'active', description: ''
  })
  formModal.show = true
}

function openEditModal(r: any) {
  formModal.isEdit = true
  formModal.rideId = r.id
  Object.assign(formData, {
    driver: r.driver, vehicle: r.vehicle || '', departure_location: r.departure_location, 
    arrival_location: r.arrival_location, departure_date: r.departure_date, 
    departure_time: r.departure_time, price_per_seat: r.price_per_seat,
    total_seats: r.total_seats, seats_available: r.seats_available, status: r.status,
    description: r.description || ''
  })
  formModal.show = true
}

function openDeleteModal(r: any) {
  deleteModal.ride = r
  deleteModal.show = true
}

async function saveRide() {
  saving.value = true
  try {
    const payload = { ...formData, vehicle: formData.vehicle || null }
    if (formModal.isEdit) {
      await fetchApi(`/rides/${formModal.rideId}/`, { method: 'PUT', body: payload })
      fetchData()
      showToast('success', 'Trajet modifié')
    } else {
      await fetchApi(`/rides/`, { method: 'POST', body: payload })
      fetchData()
      showToast('success', 'Trajet ajouté')
    }
    formModal.show = false
  } catch (e: any) {
    showToast('error', 'Erreur', e.message || 'Erreur lors de la sauvegarde.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const r = deleteModal.ride
  deleteModal.show = false
  try {
    await fetchApi(`/rides/${r.id}/`, { method: 'DELETE' })
    rides.value = rides.value.filter(item => item.id !== r.id)
    showToast('success', 'Trajet supprimé')
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de supprimer ce trajet.')
  }
}

onMounted(fetchData)
</script>
