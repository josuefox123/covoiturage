<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy pour la gestion des utilisateurs (Actifs et Archives via onglets).

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

    <!-- Archive Modal -->
    <ArchiveModal
      :show="archiveModal.show"
      :user="archiveModal.user"
      @close="archiveModal.show = false"
      @confirm="confirmArchive"
    />

    <!-- Restore Modal -->
    <RestoreModal
      :show="restoreModal.show"
      :user="restoreModal.user"
      @close="restoreModal.show = false"
      @confirm="confirmRestore"
    />

    <!-- Permanent Delete Modal -->
    <PermanentDeleteModal
      :show="deleteModal.show"
      :user="deleteModal.user"
      @close="deleteModal.show = false"
      @confirm="confirmPermanentDelete"
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
        <p class="text-sm text-textLight mt-0.5">
          {{ filteredUsers.length }} utilisateurs {{ activeTab === 'active' ? 'actifs' : 'archivés' }}
        </p>
      </div>
      <button
        v-if="activeTab === 'active'"
        @click="openCreateModal"
        class="inline-flex items-center px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/30"
      >
        <Icon name="ph:user-plus" class="w-5 h-5 mr-2" />
        Ajouter un utilisateur
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-border mb-6">
      <button
        @click="activeTab = 'active'"
        class="px-5 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-1.5"
        :class="activeTab === 'active' ? 'border-primary text-primary font-semibold' : 'border-transparent text-textLight hover:text-text'"
      >
        <span class="w-2 h-2 rounded-full bg-success"></span>
        Utilisateurs Actifs
      </button>
      <button
        @click="activeTab = 'archived'"
        class="px-5 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-1.5"
        :class="activeTab === 'archived' ? 'border-warning text-warning-dark font-semibold' : 'border-transparent text-textLight hover:text-text'"
      >
        <span class="w-2 h-2 rounded-full bg-warning"></span>
        Archives
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
            :placeholder="activeTab === 'active' ? 'Rechercher par nom, téléphone ou email...' : 'Rechercher un utilisateur archivé par nom, téléphone, email ou raison...'"
            class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
          />
        </div>
        <select
          v-if="activeTab === 'active'"
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
          <!-- Table Header -->
          <thead class="bg-background/60 text-textLight">
            <tr v-if="activeTab === 'active'">
              <th class="px-5 py-3 font-semibold">Utilisateur</th>
              <th class="px-5 py-3 font-semibold">Contact</th>
              <th class="px-5 py-3 font-semibold">Statut</th>
              <th class="px-5 py-3 font-semibold">Inscription</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
            <tr v-else>
              <th class="px-5 py-3 font-semibold">Photo</th>
              <th class="px-5 py-3 font-semibold">Nom</th>
              <th class="px-5 py-3 font-semibold">Email</th>
              <th class="px-5 py-3 font-semibold">Téléphone</th>
              <th class="px-5 py-3 font-semibold">Inscription</th>
              <th class="px-5 py-3 font-semibold">Archivé le</th>
              <th class="px-5 py-3 font-semibold">Archivé par</th>
              <th class="px-5 py-3 font-semibold">Raison</th>
              <th class="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>

          <!-- Table Body -->
          <tbody class="divide-y divide-border">
            <!-- Loader -->
            <tr v-if="pending">
              <td :colspan="activeTab === 'active' ? 5 : 9" class="py-16 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <Icon name="ph:spinner-gap" class="w-8 h-8 text-primary animate-spin" />
                  <p class="text-textMuted text-sm">Chargement des utilisateurs...</p>
                </div>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-else-if="filteredUsers.length === 0">
              <td :colspan="activeTab === 'active' ? 5 : 9" class="py-16 text-center">
                <div class="flex flex-col items-center space-y-3">
                  <div class="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                    <Icon :name="activeTab === 'active' ? 'ph:users-slash' : 'ph:archive-box'" class="w-7 h-7 text-textMuted" />
                  </div>
                  <p class="text-text font-medium">Aucun utilisateur trouvé</p>
                  <p class="text-textMuted text-sm">Essayez de modifier vos filtres ou de faire une autre recherche</p>
                </div>
              </td>
            </tr>

            <!-- Rows -->
            <template v-else>
              <!-- Active Users Rows -->
              <template v-if="activeTab === 'active'">
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
                    <div class="flex flex-col gap-1.5">
                      <span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-success/15 text-success w-fit">
                        <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-success animate-pulse"></span>
                        Actif
                      </span>
                      <span
                        class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full w-fit"
                        :class="user.is_verified ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning-dark'"
                      >
                        {{ user.is_verified ? 'Vérifié' : 'Non vérifié' }}
                      </span>
                    </div>
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
                      <!-- Archiver -->
                      <button
                        @click="openArchiveModal(user)"
                        class="p-2 bg-warning text-white shadow-sm hover:bg-warning-dark rounded-lg transition-colors flex items-center justify-center"
                        title="Archiver"
                      >
                        <Icon name="ph:archive-box" class="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </template>

              <!-- Archived Users Rows -->
              <template v-else>
                <tr
                  v-for="user in paginatedUsers"
                  :key="user.id"
                  class="hover:bg-background/30 transition-colors group"
                >
                  <!-- Photo -->
                  <td class="px-5 py-4">
                    <div class="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold overflow-hidden flex-shrink-0">
                      <img v-if="user.avatar" :src="user.avatar" alt="" class="w-full h-full object-cover" />
                      <span v-else>{{ (user.full_name || user.phone)?.charAt(0)?.toUpperCase() }}</span>
                    </div>
                  </td>

                  <!-- Nom -->
                  <td class="px-5 py-4 font-semibold text-text">
                    {{ user.full_name || 'Anonyme' }}
                  </td>

                  <!-- Email -->
                  <td class="px-5 py-4 text-textLight">
                    {{ user.email || '—' }}
                  </td>

                  <!-- Téléphone -->
                  <td class="px-5 py-4 font-medium text-text">
                    {{ user.phone }}
                  </td>

                  <!-- Inscription -->
                  <td class="px-5 py-4 text-textLight text-sm">
                    {{ user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '—' }}
                  </td>

                  <!-- Archivé le -->
                  <td class="px-5 py-4 text-textLight text-sm font-medium text-warning-dark">
                    {{ user.archived_at ? new Date(user.archived_at).toLocaleDateString('fr-FR') : '—' }}
                  </td>

                  <!-- Archivé par -->
                  <td class="px-5 py-4 text-text">
                    <span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-background border border-border">
                      {{ user.archived_by_name || 'Admin' }}
                    </span>
                  </td>

                  <!-- Raison -->
                  <td class="px-5 py-4 text-textLight max-w-xs truncate" :title="user.archive_reason">
                    {{ user.archive_reason || '—' }}
                  </td>

                  <!-- Actions -->
                  <td class="px-5 py-4">
                    <div class="flex items-center justify-end space-x-2">
                      <!-- Restaurer -->
                      <button
                        @click="openRestoreModal(user)"
                        class="p-2 bg-success text-white shadow-sm hover:bg-success-dark rounded-lg transition-colors flex items-center justify-center"
                        title="Restaurer l'utilisateur"
                      >
                        <Icon name="ph:arrow-counter-clockwise" class="w-5 h-5" />
                      </button>
                      <!-- Supprimer définitivement -->
                      <button
                        @click="openDeleteModal(user)"
                        class="p-2 bg-error text-white shadow-sm hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center"
                        title="Supprimer définitivement"
                      >
                        <Icon name="ph:trash" class="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
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
import { ref, computed, onMounted, reactive, watch } from 'vue'

const { fetchApi } = useApi()

// --- State ---
const activeTab = ref<'active' | 'archived'>('active')
const users = ref<any[]>([])
const pending = ref(true)
const search = ref('')
const filterVerified = ref('')
const page = ref(1)
const pageSize = ref(10)

// --- Modals ---
const formModal = reactive({ show: false, user: null as any })
const detailModal = reactive({ show: false, user: null as any })
const archiveModal = reactive({ show: false, user: null as any })
const restoreModal = reactive({ show: false, user: null as any })
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
      u.email?.toLowerCase().includes(q) ||
      u.archive_reason?.toLowerCase().includes(q)
    )
  }
  if (activeTab.value === 'active' && filterVerified.value !== '') {
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

watch([search, filterVerified, activeTab], () => {
  page.value = 1
})

watch(activeTab, () => {
  fetchUsers()
})

// --- API ---
async function fetchUsers() {
  pending.value = true
  try {
    const endpoint = activeTab.value === 'active' ? '/users/' : '/users/archived/'
    const data = await fetchApi<any[]>(endpoint)
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

function openArchiveModal(user: any) {
  archiveModal.user = user
  archiveModal.show = true
}

async function confirmArchive(reason: string) {
  const user = archiveModal.user
  archiveModal.show = false
  try {
    await fetchApi(`/users/${user.id}/archive/`, {
      method: 'POST',
      body: { reason }
    })
    users.value = users.value.filter(u => u.id !== user.id)
    showToast('success', 'Utilisateur archivé', `${user.full_name || user.phone} a été archivé avec succès.`)
  } catch {
    showToast('error', 'Erreur d\'archivage', 'Une erreur est survenue lors de l\'archivage.')
  }
}

function openRestoreModal(user: any) {
  restoreModal.user = user
  restoreModal.show = true
}

async function confirmRestore() {
  const user = restoreModal.user
  restoreModal.show = false
  try {
    await fetchApi(`/users/${user.id}/restore/`, { method: 'POST' })
    users.value = users.value.filter(u => u.id !== user.id)
    showToast('success', 'Utilisateur restauré', `${user.full_name || user.phone} a été restauré avec succès.`)
  } catch {
    showToast('error', 'Erreur de restauration', 'Une erreur est survenue lors de la restauration.')
  }
}

function openDeleteModal(user: any) {
  deleteModal.user = user
  deleteModal.show = true
}

async function confirmPermanentDelete() {
  const user = deleteModal.user
  deleteModal.show = false
  try {
    await fetchApi(`/users/${user.id}/permanent-delete/`, { method: 'DELETE' })
    users.value = users.value.filter(u => u.id !== user.id)
    showToast('success', 'Utilisateur supprimé', `${user.full_name || user.phone} a été supprimé définitivement.`)
  } catch {
    showToast('error', 'Erreur de suppression', 'Une erreur est survenue lors de la suppression définitive.')
  }
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

onMounted(fetchUsers)
</script>
