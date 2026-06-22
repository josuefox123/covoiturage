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

    <!-- Alert Modal (confirmation suppression) -->
    <AlertModal
      :show="deleteModal.show"
      type="danger"
      title="Supprimer cet utilisateur ?"
      :message="`Vous allez supprimer définitivement ${deleteModal.user?.full_name || deleteModal.user?.phone}. Cette action est irréversible.`"
      confirm-text="Oui, supprimer"
      cancel-text="Annuler"
      :show-cancel="true"
      @close="deleteModal.show = false"
      @confirm="confirmDelete"
    />

    <!-- User Form Modal (Ajouter / Modifier) -->
    <UserFormModal
      :show="formModal.show"
      :user="formModal.user"
      @close="formModal.show = false"
      @saved="onSaved"
    />

    <!-- User Detail Modal -->
    <UserDetailModal
      :show="detailModal.show"
      :user="detailModal.user"
      @close="detailModal.show = false"
      @edit="openEditModal"
    />

    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text">Utilisateurs</h1>
        <p class="text-sm text-textLight mt-0.5">{{ users.length }} utilisateurs enregistrés</p>
      </div>
      <button
        @click="openCreateModal"
        class="inline-flex items-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/30"
      >
        <Icon name="ph:user-plus" class="w-5 h-5 mr-2" />
        Ajouter un utilisateur
      </button>
    </div>

    <!-- Search & Filters -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
          <input
            v-model="search"
            type="text"
            placeholder="Rechercher par nom, téléphone ou email..."
            class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
          />
        </div>
        <select
          v-model="filterVerified"
          class="border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-card text-text"
        >
          <option value="">Tous les statuts</option>
          <option value="true">Vérifiés</option>
          <option value="false">Non vérifiés</option>
        </select>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/60 text-textLight">
            <tr>
              <th class="px-5 py-3 font-semibold">Utilisateur</th>
              <th class="px-5 py-3 font-semibold">Contact</th>
              <th class="px-5 py-3 font-semibold">Statut</th>
              <th class="px-5 py-3 font-semibold">Inscription</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <!-- Loader -->
            <tr v-if="pending">
              <td colspan="5" class="py-16 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <Icon name="ph:spinner-gap" class="w-8 h-8 text-primary animate-spin" />
                  <p class="text-textMuted text-sm">Chargement des utilisateurs...</p>
                </div>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="5" class="py-16 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <div class="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                    <Icon name="ph:users-slash" class="w-7 h-7 text-textMuted" />
                  </div>
                  <p class="text-text font-medium">Aucun utilisateur trouvé</p>
                  <p class="text-textMuted text-sm">Essayez de modifier vos filtres</p>
                </div>
              </td>
            </tr>

            <!-- Rows -->
            <tr
              v-for="user in paginatedUsers"
              :key="user.id"
              class="hover:bg-background/30 transition-colors group"
            >
              <td class="px-5 py-4">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden flex-shrink-0">
                    <img v-if="user.avatar" :src="user.avatar" alt="" class="w-full h-full object-cover" />
                    <span v-else>{{ (user.full_name || user.phone)?.charAt(0)?.toUpperCase() }}</span>
                  </div>
                  <div>
                    <p class="font-semibold text-text">{{ user.full_name || 'Anonyme' }}</p>
                    <div class="flex items-center text-xs text-textMuted">
                      <Icon name="ph:star-fill" class="text-warning mr-0.5 w-3 h-3" />
                      {{ user.rating || '4.5' }}
                    </div>
                  </div>
                </div>
              </td>

              <td class="px-5 py-4">
                <p class="font-medium text-text">{{ user.phone }}</p>
                <p class="text-xs text-textLight">{{ user.email || '—' }}</p>
              </td>

              <td class="px-5 py-4">
                <span
                  class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="user.is_verified ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-dark'"
                >
                  <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="user.is_verified ? 'bg-success' : 'bg-warning'"></span>
                  {{ user.is_verified ? 'Vérifié' : 'Non vérifié' }}
                </span>
              </td>

              <td class="px-5 py-4 text-textLight text-sm">
                {{ user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '—' }}
              </td>

              <td class="px-5 py-4">
                <div class="flex items-center justify-end space-x-2">
                  <!-- Détails -->
                  <button
                    @click="openDetailModal(user)"
                    class="p-2 bg-primary text-white shadow-sm hover:bg-primary-dark rounded-lg transition-colors flex items-center justify-center"
                    title="Voir les détails"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <!-- Modifier -->
                  <button
                    @click="openEditModal(user)"
                    class="p-2 bg-secondary text-white shadow-sm hover:bg-secondary-dark rounded-lg transition-colors flex items-center justify-center"
                    title="Modifier"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <!-- Supprimer -->
                  <button
                    @click="openDeleteModal(user)"
                    class="p-2 bg-error text-white shadow-sm hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center"
                    title="Supprimer"
                  >
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

      <!-- Footer -->
      <div class="p-4 border-t border-border flex items-center justify-between text-sm text-textLight">
        <span>Affichage de {{ paginatedUsers.length }} sur {{ filteredUsers.length }} résultat(s)</span>
        <div class="flex items-center space-x-1">
          <button
            class="px-3 py-1.5 rounded-lg border border-border hover:bg-background disabled:opacity-40 transition-colors"
            :disabled="page <= 1"
            @click="page--"
          >
            <Icon name="ph:caret-left" class="w-4 h-4" />
          </button>
          <span class="px-3 py-1.5 text-text font-medium">Page {{ page }} / {{ totalPages || 1 }}</span>
          <button
            class="px-3 py-1.5 rounded-lg border border-border hover:bg-background disabled:opacity-40 transition-colors"
            :disabled="page >= totalPages"
            @click="page++"
          >
            <Icon name="ph:caret-right" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'

const { fetchApi } = useApi()

// --- State ---
const users = ref<any[]>([])
const pending = ref(true)
const search = ref('')
const filterVerified = ref('')
const page = ref(1)
const pageSize = ref(10)

// --- Modals ---
const formModal = reactive({ show: false, user: null as any })
const detailModal = reactive({ show: false, user: null as any })
const deleteModal = reactive({ show: false, user: null as any })

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

// --- Computed ---
const filteredUsers = computed(() => {
  let list = users.value
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(u =>
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    )
  }
  if (filterVerified.value !== '') {
    const v = filterVerified.value === 'true'
    list = list.filter(u => u.is_verified === v)
  }
  return list
})

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / pageSize.value))

const paginatedUsers = computed(() => {
  const start = (page.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredUsers.value.slice(start, end)
})

watch([search, filterVerified], () => {
  page.value = 1
})

// --- API ---
async function fetchUsers() {
  pending.value = true
  try {
    const data = await fetchApi<any[]>('/users/')
    users.value = Array.isArray(data) ? data : (data as any).results || []
  } catch {
    showToast('error', 'Erreur de chargement', 'Impossible de récupérer les utilisateurs.')
  } finally {
    pending.value = false
  }
}

// --- Modal handlers ---
function openCreateModal() {
  formModal.user = null
  formModal.show = true
}

function openEditModal(user: any) {
  detailModal.show = false
  formModal.user = user
  formModal.show = true
}

function openDetailModal(user: any) {
  detailModal.user = user
  detailModal.show = true
}

function openDeleteModal(user: any) {
  deleteModal.user = user
  deleteModal.show = true
}

function onSaved(savedUser: any) {
  const idx = users.value.findIndex(u => u.id === savedUser.id)
  if (idx !== -1) {
    users.value.splice(idx, 1, savedUser)
    showToast('success', 'Utilisateur mis à jour', `${savedUser.full_name || savedUser.phone} a été modifié avec succès.`)
  } else {
    users.value.unshift(savedUser)
    showToast('success', 'Utilisateur créé', `${savedUser.full_name || savedUser.phone} a été ajouté avec succès.`)
  }
  formModal.show = false
}

async function confirmDelete() {
  const user = deleteModal.user
  deleteModal.show = false
  try {
    await fetchApi(`/users/${user.id}/`, { method: 'DELETE' })
    users.value = users.value.filter(u => u.id !== user.id)
    showToast('success', 'Utilisateur supprimé', `${user.full_name || user.phone} a été supprimé.`)
  } catch {
    showToast('error', 'Erreur de suppression', 'Une erreur est survenue lors de la suppression.')
  }
}

onMounted(fetchUsers)
</script>
