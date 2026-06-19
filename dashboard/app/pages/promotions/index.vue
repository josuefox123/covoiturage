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

    <!-- Alert Modal (confirmation suppression) -->
    <AlertModal
      :show="deleteModal.show"
      type="danger"
      title="Supprimer cette promotion ?"
      :message="`Vous allez supprimer définitivement l'offre '${deleteModal.promo?.title}'. Cette action est irréversible.`"
      confirm-text="Oui, supprimer"
      cancel-text="Annuler"
      :show-cancel="true"
      @close="deleteModal.show = false"
      @confirm="confirmDelete"
    />

    <!-- Modal Formulaire (Ajout / Edition) -->
    <div v-if="formModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 class="text-xl font-bold text-text">{{ formModal.isEditing ? 'Modifier la promotion' : 'Nouvelle promotion' }}</h2>
          <button @click="closeFormModal" class="p-2 text-textMuted hover:bg-background rounded-full transition-colors">
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 overflow-y-auto flex-1 space-y-4">
          
          <div>
            <label class="block text-sm font-medium text-text mb-1">Titre *</label>
            <input v-model="form.title" type="text" class="w-full px-3 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:border-primary" placeholder="-50% sur le 1er trajet" />
          </div>

          <div>
            <label class="block text-sm font-medium text-text mb-1">Sous-titre</label>
            <input v-model="form.subtitle" type="text" class="w-full px-3 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:border-primary" placeholder="Utilisez le code BIENVENUE" />
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-text mb-1">Couleur</label>
              <input v-model="form.color" type="color" class="w-full h-10 px-1 py-1 border border-border rounded-lg bg-background cursor-pointer" />
            </div>
            <div class="flex-1 relative">
              <label class="block text-sm font-medium text-text mb-1">Icône</label>
              <button 
                @click.prevent="showIconSelector = !showIconSelector"
                class="w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:border-primary hover:bg-background/80"
              >
                <div class="flex items-center gap-2">
                  <Icon v-if="form.icon" :name="`ion:${form.icon}`" class="w-5 h-5 text-primary" />
                  <span v-if="form.icon" class="truncate max-w-[100px]">{{ form.icon }}</span>
                  <span v-else class="text-textMuted">Choisir</span>
                </div>
                <Icon name="ph:caret-down" class="w-4 h-4 text-textMuted" />
              </button>

              <!-- Dropdown Sélecteur d'icônes -->
              <div v-if="showIconSelector" class="absolute z-10 mt-1 w-64 sm:w-[280px] bg-card border border-border rounded-xl shadow-lg p-3 max-h-60 overflow-y-auto right-0 sm:-right-4">
                <div class="grid grid-cols-5 gap-2">
                  <button 
                    v-for="icon in predefinedIcons" 
                    :key="icon"
                    @click.prevent="form.icon = icon; showIconSelector = false"
                    class="p-2 rounded-lg flex items-center justify-center transition-colors"
                    :class="form.icon === icon ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-background text-text hover:text-primary'"
                    :title="icon"
                  >
                    <Icon :name="`ion:${icon}`" class="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-text mb-1">Position (Ordre)</label>
              <input v-model.number="form.position" type="number" class="w-full px-3 py-2 border border-border rounded-lg bg-background text-text focus:outline-none focus:border-primary" />
            </div>
            <div class="flex-1 flex items-end">
              <label class="flex items-center space-x-2 pb-2 cursor-pointer">
                <input type="checkbox" v-model="form.is_active" class="rounded text-primary focus:ring-primary h-5 w-5 border-gray-300" />
                <span class="text-sm font-medium text-text">Active</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-text mb-1">Image de fond *</label>
            <input type="file" @change="onFileChange" accept="image/*" class="w-full text-sm text-textMuted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
            <div v-if="imagePreview || formModal.promo?.image" class="mt-2 h-32 w-full rounded-lg overflow-hidden border border-border relative">
              <img :src="imagePreview || formModal.promo?.image" class="w-full h-full object-cover" />
            </div>
          </div>

        </div>
        <div class="px-6 py-4 border-t border-border flex justify-end gap-3 bg-background/50">
          <button @click="closeFormModal" class="px-4 py-2 font-medium text-textLight hover:text-text transition-colors">Annuler</button>
          <button @click="savePromotion" class="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-50" :disabled="saving">
            <Icon v-if="saving" name="ph:spinner-gap" class="w-5 h-5 animate-spin inline mr-2" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text">Promotions</h1>
        <p class="text-sm text-textLight mt-0.5">Gérez les offres spéciales affichées sur l'application mobile</p>
      </div>
      <button
        @click="openCreateModal"
        class="inline-flex items-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/30"
      >
        <Icon name="ph:plus" class="w-5 h-5 mr-2" />
        Nouvelle promotion
      </button>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/60 text-textLight">
            <tr>
              <th class="px-5 py-3 font-semibold w-16">Pos</th>
              <th class="px-5 py-3 font-semibold">Offre</th>
              <th class="px-5 py-3 font-semibold">Statut</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <!-- Loader -->
            <tr v-if="pending">
              <td colspan="4" class="py-16 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <Icon name="ph:spinner-gap" class="w-8 h-8 text-primary animate-spin" />
                  <p class="text-textMuted text-sm">Chargement des promotions...</p>
                </div>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-else-if="promotions.length === 0">
              <td colspan="4" class="py-16 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <div class="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                    <Icon name="ph:star-slash" class="w-7 h-7 text-textMuted" />
                  </div>
                  <p class="text-text font-medium">Aucune promotion trouvée</p>
                  <p class="text-textMuted text-sm">Créez votre première offre spéciale</p>
                </div>
              </td>
            </tr>

            <!-- Rows -->
            <tr
              v-for="promo in promotions"
              :key="promo.id"
              class="hover:bg-background/30 transition-colors group"
            >
              <td class="px-5 py-4 text-textMuted font-medium text-center">
                {{ promo.position }}
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center space-x-3">
                  <div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0" :style="{ backgroundColor: promo.color }">
                    <img v-if="promo.image" :src="promo.image" alt="" class="w-full h-full object-cover opacity-80 mix-blend-overlay" />
                    <Icon v-else-if="promo.icon" :name="`ion:${promo.icon}`" class="w-6 h-6 text-white absolute" />
                  </div>
                  <div>
                    <p class="font-semibold text-text">{{ promo.title }}</p>
                    <p class="text-xs text-textMuted">{{ promo.subtitle || '—' }}</p>
                  </div>
                </div>
              </td>

              <td class="px-5 py-4">
                <button
                  @click="toggleActive(promo)"
                  class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                  :class="promo.is_active ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500'"
                >
                  <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="promo.is_active ? 'bg-success' : 'bg-gray-400'"></span>
                  {{ promo.is_active ? 'Active' : 'Désactivée' }}
                </button>
              </td>

              <td class="px-5 py-4">
                <div class="flex items-center justify-end space-x-2">
                  <button
                    @click="openEditModal(promo)"
                    class="p-2 bg-secondary text-white shadow-sm hover:bg-secondary-dark rounded-lg transition-colors flex items-center justify-center"
                    title="Modifier"
                  >
                    <Icon name="ph:pencil-simple" class="w-5 h-5" />
                  </button>
                  <button
                    @click="openDeleteModal(promo)"
                    class="p-2 bg-error text-white shadow-sm hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center"
                    title="Supprimer"
                  >
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
import { ref, onMounted, reactive } from 'vue'

const { fetchApi } = useApi()

const predefinedIcons = [
  'star-outline', 'star', 'gift-outline', 'gift', 
  'car-outline', 'car', 'flash-outline', 'flash', 
  'pricetag-outline', 'pricetag', 'wallet-outline', 'wallet',
  'cash-outline', 'cash', 'calendar-outline', 'calendar',
  'time-outline', 'time', 'people-outline', 'people',
  'location-outline', 'location', 'navigate-outline', 'navigate',
  'leaf-outline', 'leaf', 'shield-checkmark-outline', 'shield-checkmark',
  'trophy-outline', 'trophy', 'heart-outline', 'heart',
  'rocket-outline', 'rocket', 'diamond-outline', 'diamond'
]

// --- State ---
const promotions = ref<any[]>([])
const pending = ref(true)
const showIconSelector = ref(false)

// --- Modals ---
const deleteModal = reactive({ show: false, promo: null as any })
const formModal = reactive({ show: false, isEditing: false, promo: null as any })
const saving = ref(false)

// --- Form State ---
const form = reactive({
  title: '',
  subtitle: '',
  color: '#2563EB',
  icon: '',
  position: 0,
  is_active: true
})
const selectedFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)

// --- Toast ---
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

// --- API ---
async function fetchPromotions() {
  pending.value = true
  try {
    const data = await fetchApi<any[]>('/promotions/')
    promotions.value = Array.isArray(data) ? data : (data as any).results || []
    // Sort by position
    promotions.value.sort((a, b) => a.position - b.position)
  } catch {
    showToast('error', 'Erreur', 'Impossible de récupérer les promotions.')
  } finally {
    pending.value = false
  }
}

// --- Handlers ---
function openCreateModal() {
  form.title = ''
  form.subtitle = ''
  form.color = '#2563EB'
  form.icon = ''
  form.position = promotions.value.length
  form.is_active = true
  selectedFile.value = null
  imagePreview.value = null
  showIconSelector.value = false
  
  formModal.promo = null
  formModal.isEditing = false
  formModal.show = true
}

function openEditModal(promo: any) {
  form.title = promo.title
  form.subtitle = promo.subtitle || ''
  form.color = promo.color || '#2563EB'
  form.icon = promo.icon || ''
  form.position = promo.position || 0
  form.is_active = promo.is_active
  selectedFile.value = null
  imagePreview.value = null
  showIconSelector.value = false
  
  formModal.promo = promo
  formModal.isEditing = true
  formModal.show = true
}

function closeFormModal() {
  formModal.show = false
}

function onFileChange(e: any) {
  const file = e.target.files[0]
  if (file) {
    selectedFile.value = file
    const reader = new FileReader()
    reader.onload = e => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

async function savePromotion() {
  if (!form.title) {
    showToast('error', 'Erreur', 'Le titre est obligatoire.')
    return
  }
  if (!formModal.isEditing && !selectedFile.value) {
    showToast('error', 'Erreur', 'Une image est obligatoire pour une nouvelle promotion.')
    return
  }

  saving.value = true
  try {
    const formData = new FormData()
    formData.append('title', form.title)
    if (form.subtitle) formData.append('subtitle', form.subtitle)
    formData.append('color', form.color)
    if (form.icon) formData.append('icon', form.icon)
    formData.append('position', form.position.toString())
    formData.append('is_active', form.is_active.toString())
    
    if (selectedFile.value) {
      formData.append('image', selectedFile.value)
    }

    if (formModal.isEditing) {
      const res = await fetchApi<any>(`/promotions/${formModal.promo.id}/`, {
        method: 'PUT',
        body: formData
      })
      const idx = promotions.value.findIndex(p => p.id === formModal.promo.id)
      if (idx !== -1) promotions.value.splice(idx, 1, res)
      showToast('success', 'Succès', 'Promotion modifiée.')
    } else {
      const res = await fetchApi<any>('/promotions/', {
        method: 'POST',
        body: formData
      })
      promotions.value.push(res)
      showToast('success', 'Succès', 'Promotion créée.')
    }
    
    promotions.value.sort((a, b) => a.position - b.position)
    closeFormModal()
  } catch (err) {
    console.error(err)
    showToast('error', 'Erreur', 'Impossible de sauvegarder la promotion.')
  } finally {
    saving.value = false
  }
}

function openDeleteModal(promo: any) {
  deleteModal.promo = promo
  deleteModal.show = true
}

async function confirmDelete() {
  const promo = deleteModal.promo
  deleteModal.show = false
  try {
    await fetchApi(`/promotions/${promo.id}/`, { method: 'DELETE' })
    promotions.value = promotions.value.filter(p => p.id !== promo.id)
    showToast('success', 'Supprimée', 'La promotion a été supprimée.')
  } catch {
    showToast('error', 'Erreur', 'Impossible de supprimer la promotion.')
  }
}

async function toggleActive(promo: any) {
  try {
    const newStatus = !promo.is_active
    const formData = new FormData()
    formData.append('title', promo.title) // required field, although we use PATCH, rest_framework might need required fields if we don't set partial=True on the viewset. Oh wait, ModelViewSet supports PATCH perfectly with partial=True natively.
    // Actually, let's just send the patch with json
    await fetchApi(`/promotions/${promo.id}/`, {
      method: 'PATCH',
      body: { is_active: newStatus }
    })
    promo.is_active = newStatus
    showToast('success', 'Succès', `Promotion ${newStatus ? 'activée' : 'désactivée'}.`)
  } catch {
    showToast('error', 'Erreur', 'Impossible de modifier le statut.')
  }
}

onMounted(fetchPromotions)
</script>
