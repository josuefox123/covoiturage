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
      title="Supprimer cette réservation ?"
      :message="`Vous allez supprimer la réservation de ${deleteModal.booking?.passenger_details?.full_name || deleteModal.booking?.passenger_details?.phone}.`"
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
          <h3 class="text-lg font-bold text-text">{{ formModal.isEdit ? 'Modifier la réservation' : 'Ajouter une réservation' }}</h3>
          <button @click="formModal.show = false" class="text-textMuted hover:text-text">
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
        </div>
        <form @submit.prevent="saveBooking" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-text mb-1">Passager</label>
            <select v-model="formData.passenger" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" :disabled="formModal.isEdit">
              <option value="" disabled>Sélectionner un passager</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.full_name || u.phone }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Trajet</label>
            <select v-model="formData.ride" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" :disabled="formModal.isEdit">
              <option value="" disabled>Sélectionner un trajet</option>
              <option v-for="r in rides" :key="r.id" :value="r.id">
                {{ r.departure_location }} -> {{ r.arrival_location }} ({{ r.departure_date }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Places réservées</label>
            <input v-model="formData.seats_booked" type="number" min="1" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Statut</label>
            <select v-model="formData.status" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20">
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="cancelled">Annulée</option>
              <option value="completed">Terminée</option>
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
        <h1 class="text-2xl font-bold text-text">Réservations</h1>
        <p class="text-sm text-textLight mt-0.5">{{ bookings.length }} réservations enregistrées</p>
      </div>
      <button @click="openCreateModal" class="inline-flex items-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark shadow-sm">
        <Icon name="ph:plus" class="w-5 h-5 mr-2" />
        Ajouter une réservation
      </button>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/60 text-textLight">
            <tr>
              <th class="px-5 py-3 font-semibold">Trajet</th>
              <th class="px-5 py-3 font-semibold">Passager</th>
              <th class="px-5 py-3 font-semibold">Places</th>
              <th class="px-5 py-3 font-semibold">Statut</th>
              <th class="px-5 py-3 font-semibold">Date</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending">
              <td colspan="6" class="py-10 text-center text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="bookings.length === 0">
              <td colspan="6" class="py-10 text-center text-textMuted">Aucune réservation trouvée.</td>
            </tr>
            <tr v-for="booking in bookings" :key="booking.id" class="hover:bg-background/30 transition-colors">
              <td class="px-5 py-4">
                <p class="font-semibold text-text">{{ booking.ride_details?.departure_location }} &rarr; {{ booking.ride_details?.arrival_location }}</p>
                <p class="text-xs text-textLight">{{ booking.ride_details?.departure_date }}</p>
              </td>
              <td class="px-5 py-4 text-text">{{ booking.passenger_details?.full_name || booking.passenger_details?.phone }}</td>
              <td class="px-5 py-4 text-text"><Icon name="ph:users" class="inline mr-1" /> {{ booking.seats_booked }}</td>
              <td class="px-5 py-4">
                <span 
                  class="px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="{
                    'bg-warning/10 text-warningDark': booking.status === 'pending',
                    'bg-success/10 text-success': booking.status === 'confirmed',
                    'bg-error/10 text-error': booking.status === 'cancelled',
                    'bg-textLight/10 text-textLight': booking.status === 'completed'
                  }"
                >
                  {{ booking.status }}
                </span>
              </td>
              <td class="px-5 py-4 text-textLight">{{ new Date(booking.created_at).toLocaleDateString() }}</td>
              <td class="px-5 py-4 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <button @click="openEditModal(booking)" class="p-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark" title="Modifier">
                    <Icon name="ph:pencil-simple" class="w-5 h-5" />
                  </button>
                  <button @click="openDeleteModal(booking)" class="p-2 bg-error text-white rounded-lg hover:bg-red-700" title="Supprimer">
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
import { ref, reactive, onMounted } from 'vue'

const { fetchApi } = useApi()

const bookings = ref<any[]>([])
const users = ref<any[]>([])
const rides = ref<any[]>([])
const pending = ref(true)
const saving = ref(false)

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })
const deleteModal = reactive({ show: false, booking: null as any })
const formModal = reactive({ show: false, isEdit: false, bookingId: null as any })
const formData = reactive({ passenger: '', ride: '', seats_booked: 1, status: 'pending' })

function showToast(type: string, title: string, msg = '') {
  toast.type = type; toast.title = title; toast.message = msg; toast.show = true
}

async function fetchData() {
  pending.value = true
  try {
    const [bRes, uRes, rRes] = await Promise.all([
      fetchApi<any>('/bookings/'),
      fetchApi<any>('/users/'),
      fetchApi<any>('/rides/')
    ])
    bookings.value = Array.isArray(bRes) ? bRes : bRes.results || []
    users.value = Array.isArray(uRes) ? uRes : uRes.results || []
    rides.value = Array.isArray(rRes) ? rRes : rRes.results || []
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de charger les données.')
  } finally {
    pending.value = false
  }
}

function openCreateModal() {
  formModal.isEdit = false
  formModal.bookingId = null
  formData.passenger = ''
  formData.ride = ''
  formData.seats_booked = 1
  formData.status = 'pending'
  formModal.show = true
}

function openEditModal(b: any) {
  formModal.isEdit = true
  formModal.bookingId = b.id
  formData.passenger = b.passenger
  formData.ride = b.ride
  formData.seats_booked = b.seats_booked
  formData.status = b.status
  formModal.show = true
}

function openDeleteModal(b: any) {
  deleteModal.booking = b
  deleteModal.show = true
}

async function saveBooking() {
  saving.value = true
  try {
    const payload = { ...formData }
    if (formModal.isEdit) {
      const res = await fetchApi(`/bookings/${formModal.bookingId}/`, { method: 'PUT', body: payload })
      const idx = bookings.value.findIndex(b => b.id === formModal.bookingId)
      // On recharge tout pour avoir les "details" imbriqués mis à jour correctement via le backend
      fetchData() 
      showToast('success', 'Réservation modifiée')
    } else {
      const res = await fetchApi(`/bookings/`, { method: 'POST', body: payload })
      fetchData()
      showToast('success', 'Réservation ajoutée')
    }
    formModal.show = false
  } catch (e: any) {
    showToast('error', 'Erreur', e.message || 'Vérifiez les informations saisies.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const b = deleteModal.booking
  deleteModal.show = false
  try {
    await fetchApi(`/bookings/${b.id}/`, { method: 'DELETE' })
    bookings.value = bookings.value.filter(item => item.id !== b.id)
    showToast('success', 'Réservation supprimée')
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de supprimer cette réservation.')
  }
}

onMounted(fetchData)
</script>
