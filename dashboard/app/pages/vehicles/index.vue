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
      title="Supprimer ce véhicule ?"
      :message="`Vous allez supprimer définitivement le véhicule ${deleteModal.vehicle?.brand_model} (${deleteModal.vehicle?.license_plate}).`"
      confirm-text="Oui, supprimer"
      cancel-text="Annuler"
      :show-cancel="true"
      @close="deleteModal.show = false"
      @confirm="confirmDelete"
    />

    <!-- Form Modal (Ajouter / Modifier) -->
    <div v-if="formModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden" @click.stop>
        <div class="px-6 py-4 border-b border-border flex justify-between items-center bg-background/50">
          <h3 class="text-lg font-bold text-text">{{ formModal.isEdit ? 'Modifier le véhicule' : 'Ajouter un véhicule' }}</h3>
          <button @click="formModal.show = false" class="text-textMuted hover:text-text">
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
        </div>
        <form @submit.prevent="saveVehicle" class="p-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Colonne 1: Infos Véhicule -->
            <div class="space-y-4">
              <h4 class="font-semibold text-primary mb-2 flex items-center gap-2">
                <Icon name="ph:car" class="w-5 h-5" />
                Informations du Véhicule
              </h4>
              <div>
                <label class="block text-sm font-medium text-text mb-1">Propriétaire</label>
                <select v-model="formData.owner" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 bg-white">
                  <option value="" disabled>Sélectionner un propriétaire</option>
                  <option v-for="u in users" :key="u.id" :value="u.id">
                    {{ u.full_name || u.phone }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-text mb-1">Type de véhicule</label>
                <select v-model="formData.vehicle_type" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 bg-white">
                  <option value="voiture">Voiture</option>
                  <option value="moto">Moto</option>
                  <option value="tricycle">Tricycle</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-text mb-1">Marque & Modèle</label>
                <input v-model="formData.brand_model" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" placeholder="ex: Peugeot 208">
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-text mb-1">Immatriculation</label>
                  <input v-model="formData.license_plate" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" placeholder="ex: AB-123-CD">
                </div>
                <div>
                  <label class="block text-sm font-medium text-text mb-1">Couleur</label>
                  <input v-model="formData.color" type="text" required class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20" placeholder="ex: Noir">
                </div>
              </div>
            </div>

            <!-- Colonne 2: Permis -->
            <div class="space-y-4">
              <h4 class="font-semibold text-primary mb-2 flex items-center gap-2">
                <Icon name="ph:identification-card" class="w-5 h-5" />
                Permis de conduire
              </h4>
              <div v-if="formData.vehicle_type === 'voiture'" class="space-y-4 bg-background/50 p-4 rounded-xl border border-border">
                <div>
                  <label class="block text-sm font-medium text-text mb-1">Numéro de Permis</label>
                  <input v-model="formData.driver_license_number" type="text" class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 bg-white" placeholder="ex: B-123456">
                </div>
                <div>
                  <label class="block text-sm font-medium text-text mb-1">Expiration du Permis</label>
                  <input v-model="formData.license_expiration" type="date" class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 bg-white">
                </div>
                <div>
                  <label class="block text-sm font-medium text-text mb-1">Photo du Permis</label>
                  <input type="file" @change="handleFileUpload" accept="image/*" class="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 bg-white text-sm">
                  <p class="text-xs text-textMuted mt-1">Dimensions recommandées : 800x600 pixels (format paysage).</p>
                </div>
              </div>
              <div v-else class="text-sm text-textLight italic p-4 bg-background/50 rounded-xl border border-border">
                Le permis de conduire n'est pas obligatoire pour ce type de véhicule.
              </div>
            </div>
          </div>

          <div class="mt-8 pt-4 border-t border-border flex justify-end space-x-3">
            <button type="button" @click="formModal.show = false" class="px-5 py-2.5 border border-border rounded-xl hover:bg-background font-medium">Annuler</button>
            <button type="submit" class="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark font-medium shadow-sm" :disabled="saving">
              <span v-if="saving">Enregistrement...</span>
              <span v-else>Enregistrer le véhicule</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text">Véhicules</h1>
        <p class="text-sm text-textLight mt-0.5">{{ vehicles.length }} véhicules enregistrés</p>
      </div>
      <button @click="openCreateModal" class="inline-flex items-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark shadow-sm">
        <Icon name="ph:plus" class="w-5 h-5 mr-2" />
        Ajouter un véhicule
      </button>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-background/60 text-textLight">
            <tr>
              <th class="px-5 py-3 font-semibold">Véhicule</th>
              <th class="px-5 py-3 font-semibold">Immatriculation</th>
              <th class="px-5 py-3 font-semibold">Propriétaire</th>
              <th class="px-5 py-3 font-semibold">Permis de Conduire</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending">
              <td colspan="5" class="py-10 text-center text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="vehicles.length === 0">
              <td colspan="5" class="py-10 text-center text-textMuted">Aucun véhicule trouvé.</td>
            </tr>
            <tr v-for="vehicle in vehicles" :key="vehicle.id" class="hover:bg-background/30 transition-colors">
              <td class="px-5 py-4">
                <p class="font-semibold text-text">{{ vehicle.brand_model }}</p>
                <p class="text-xs text-textLight">{{ vehicle.color }}</p>
              </td>
              <td class="px-5 py-4"><span class="px-2 py-1 bg-background rounded border border-border font-mono">{{ vehicle.license_plate }}</span></td>
              <td class="px-5 py-4">
                <p class="font-medium text-text">{{ getUserName(vehicle.owner) }}</p>
                <p class="text-xs text-textLight">{{ getUserPhone(vehicle.owner) }}</p>
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <a :href="getPhotoUrl(vehicle.driver_license_photo)" target="_blank" title="Voir l'image en grand">
                    <img :src="getPhotoUrl(vehicle.driver_license_photo)" alt="Permis" class="w-10 h-10 object-cover rounded shadow-sm border border-border hover:opacity-80 transition-opacity">
                  </a>
                  <div v-if="vehicle.driver_license_number">
                    <p class="font-medium text-text">{{ vehicle.driver_license_number }}</p>
                    <p class="text-xs text-textLight" :class="isExpired(vehicle.license_expiration) ? 'text-error' : 'text-success'">
                      Exp: {{ vehicle.license_expiration ? new Date(vehicle.license_expiration).toLocaleDateString('fr-FR') : 'Non définie' }}
                    </p>
                  </div>
                  <div v-else class="text-xs text-warning bg-warning/10 px-2 py-1 inline-block rounded">
                    Non renseigné
                  </div>
                </div>
              </td>

              <td class="px-5 py-4 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <button @click="openEditModal(vehicle)" class="p-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark" title="Modifier">
                    <Icon name="ph:pencil-simple" class="w-5 h-5" />
                  </button>
                  <button @click="openDeleteModal(vehicle)" class="p-2 bg-error text-white rounded-lg hover:bg-red-700" title="Supprimer">
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

const vehicles = ref<any[]>([])
const users = ref<any[]>([])
const pending = ref(true)
const saving = ref(false)

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })
const deleteModal = reactive({ show: false, vehicle: null as any })
const formModal = reactive({ show: false, isEdit: false, vehicleId: null as any })
const formData = reactive({ owner: '', vehicle_type: 'voiture', brand_model: '', license_plate: '', color: '', driver_license_number: '', license_expiration: '' })
const selectedFile = ref<File | null>(null)

const config = useRuntimeConfig()
const apiBaseUrl = config.public.apiBase ? (config.public.apiBase as string).replace(/\/api\/?$/, '') : 'https://zemy.erika-app.com'

function getPhotoUrl(url: string) {
  if (!url) return '/images/logozemy.png'
  if (url.startsWith('http')) return url
  return `${apiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0] || null
  }
}

function showToast(type: string, title: string, msg = '') {
  toast.type = type; toast.title = title; toast.message = msg; toast.show = true
}

function isExpired(dateString: string) {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

async function fetchData() {
  pending.value = true
  try {
    const [vRes, uRes] = await Promise.all([
      fetchApi<any>('/vehicles/'),
      fetchApi<any>('/users/')
    ])
    vehicles.value = Array.isArray(vRes) ? vRes : vRes.results || []
    users.value = Array.isArray(uRes) ? uRes : uRes.results || []
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de charger les données.')
  } finally {
    pending.value = false
  }
}

function getUserName(id: string) {
  const u = users.value.find(u => u.id === id)
  return u ? (u.full_name || u.phone) : 'Inconnu'
}

function getUserPhone(id: string) {
  const u = users.value.find(u => u.id === id)
  return u ? (u.email || u.phone) : ''
}

function openCreateModal() {
  formModal.isEdit = false
  formModal.vehicleId = null
  formData.owner = ''
  formData.vehicle_type = 'voiture'
  formData.brand_model = ''
  formData.license_plate = ''
  formData.color = ''
  formData.driver_license_number = ''
  formData.license_expiration = ''
  selectedFile.value = null
  formModal.show = true
}

function openEditModal(v: any) {
  formModal.isEdit = true
  formModal.vehicleId = v.id
  formData.owner = v.owner
  formData.vehicle_type = v.vehicle_type || 'voiture'
  formData.brand_model = v.brand_model
  formData.license_plate = v.license_plate
  formData.color = v.color
  formData.driver_license_number = v.driver_license_number || ''
  formData.license_expiration = v.license_expiration || ''
  selectedFile.value = null
  formModal.show = true
}

function openDeleteModal(v: any) {
  deleteModal.vehicle = v
  deleteModal.show = true
}

async function saveVehicle() {
  saving.value = true
  try {
    const payload = new FormData()
    payload.append('owner', formData.owner)
    payload.append('vehicle_type', formData.vehicle_type)
    payload.append('brand_model', formData.brand_model)
    payload.append('license_plate', formData.license_plate)
    payload.append('color', formData.color)
    
    if (formData.vehicle_type === 'voiture') {
      if (formData.driver_license_number) payload.append('driver_license_number', formData.driver_license_number)
      if (formData.license_expiration) payload.append('license_expiration', formData.license_expiration)
      if (selectedFile.value) {
        payload.append('driver_license_photo', selectedFile.value)
      }
    } else {
      payload.append('driver_license_number', '')
      payload.append('license_expiration', '')
    }

    if (formModal.isEdit) {
      const res = await fetchApi(`/vehicles/${formModal.vehicleId}/`, { method: 'PATCH', body: payload })
      const idx = vehicles.value.findIndex(v => v.id === formModal.vehicleId)
      if (idx !== -1) vehicles.value[idx] = res
      showToast('success', 'Véhicule modifié')
    } else {
      const res = await fetchApi(`/vehicles/`, { method: 'POST', body: payload })
      vehicles.value.unshift(res)
      showToast('success', 'Véhicule ajouté')
    }
    formModal.show = false
  } catch (e) {
    showToast('error', 'Erreur', 'Vérifiez les informations saisies.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  const v = deleteModal.vehicle
  deleteModal.show = false
  try {
    await fetchApi(`/vehicles/${v.id}/`, { method: 'DELETE' })
    vehicles.value = vehicles.value.filter(item => item.id !== v.id)
    showToast('success', 'Véhicule supprimé')
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de supprimer ce véhicule.')
  }
}

onMounted(fetchData)
</script>
