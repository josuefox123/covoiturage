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

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <h1 class="text-2xl font-bold text-text">Notifications</h1>
      <button @click="openModal" class="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center">
        <Icon name="ph:paper-plane-right" class="mr-2 w-5 h-5" />
        Envoyer une notification
      </button>
    </div>

    <!-- Stats & Filters -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
      <div class="lg:col-span-1 bg-card rounded-xl p-6 border border-border shadow-sm flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-textMuted mb-1">Total envoyées</p>
          <div class="flex items-center gap-3">
            <h3 class="text-3xl font-bold text-text">{{ notifications.length }}</h3>
            <span class="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {{ notifications.length }} notifications
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Icon name="ph:megaphone" class="w-6 h-6" />
        </div>
      </div>

      <div class="lg:col-span-3 bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <button v-for="f in ['all', 'global', 'private', 'read', 'unread']" :key="f" 
            @click="filter = f"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
            :class="filter === f ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-background border-border text-textMuted hover:text-text hover:bg-border/50'">
            {{ filterLabels[f] }}
          </button>
        </div>
        <div class="relative w-full sm:w-64">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted" />
          <input 
            v-model="search" 
            type="text" 
            placeholder="Rechercher..." 
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/50 text-textLight border-b border-border">
            <tr>
              <th class="px-6 py-4 font-semibold">Date</th>
              <th class="px-6 py-4 font-semibold">Destinataire</th>
              <th class="px-6 py-4 font-semibold">Contenu</th>
              <th class="px-6 py-4 font-semibold">Statut</th>
              <th class="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <template v-if="pending">
              <tr v-for="i in 5" :key="'skel'+i" class="animate-pulse">
                <td class="px-6 py-4"><div class="h-4 bg-border rounded w-24 mb-2"></div><div class="h-3 bg-border rounded w-16"></div></td>
                <td class="px-6 py-4"><div class="h-6 bg-border rounded-full w-32"></div></td>
                <td class="px-6 py-4"><div class="h-4 bg-border rounded w-48 mb-2"></div><div class="h-3 bg-border rounded w-64"></div></td>
                <td class="px-6 py-4"><div class="h-6 bg-border rounded-full w-16"></div></td>
                <td class="px-6 py-4"><div class="h-8 bg-border rounded w-16 ml-auto"></div></td>
              </tr>
            </template>
            <tr v-else-if="paginatedNotifications.length === 0" class="text-center">
              <td colspan="5" class="py-12 text-textMuted">
                <Icon name="ph:bell-slash" class="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aucune notification trouvée.</p>
              </td>
            </tr>
            <tr v-for="notif in paginatedNotifications" :key="notif.id" class="hover:bg-background/50 transition-colors group">
              <td class="px-6 py-4 whitespace-nowrap">
                <p class="font-semibold text-text">{{ timeAgo(notif.created_at) }}</p>
                <p class="text-xs text-textMuted">{{ new Date(notif.created_at).toLocaleString('fr-FR') }}</p>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <Icon :name="notif.user ? 'ph:user' : 'ph:users'" class="w-5 h-5 text-primary" />
                  <div>
                    <span v-if="!notif.user" class="font-semibold text-text">Notification globale</span>
                    <span v-else class="font-semibold text-text">Notification privée</span>
                    <p class="text-xs text-textMuted mt-0.5">
                      {{ notif.user ? getUserName(notif) : `${users.length} utilisateurs` }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <p class="font-semibold text-text">{{ notif.title }}</p>
                <p class="text-textMuted text-xs mt-1 max-w-sm truncate" :title="notif.message">{{ notif.message }}</p>
              </td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border" 
                  :class="notif.is_read ? 'bg-success/10 border-success/20 text-success' : 'bg-warning/10 border-warning/20 text-warningDark'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="notif.is_read ? 'bg-success' : 'bg-warning'"></span>
                  {{ notif.is_read ? 'Lue' : 'Non lue' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="viewNotification(notif)" class="p-2 text-textLight hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Voir">
                    <Icon name="ph:eye" class="w-4 h-4" />
                  </button>
                  <button @click="confirmDelete(notif.id)" class="p-2 text-textLight hover:text-error hover:bg-error/10 rounded-lg transition-colors" title="Supprimer">
                    <Icon name="ph:trash" class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="p-4 border-t border-border flex items-center justify-between">
        <p class="text-sm text-textMuted">Affichage de {{ (currentPage - 1) * perPage + 1 }} à {{ Math.min(currentPage * perPage, filteredNotifications.length) }} sur {{ filteredNotifications.length }}</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage--" :disabled="currentPage === 1" class="p-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 transition-colors">
            <Icon name="ph:caret-left" class="w-4 h-4" />
          </button>
          <span class="text-sm font-medium px-2">Page {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage++" :disabled="currentPage === totalPages" class="p-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 transition-colors">
            <Icon name="ph:caret-right" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modale d'envoi -->
    <Teleport to="body">
      <div v-if="isModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border">
          <div class="p-6 border-b border-border flex justify-between items-center bg-background/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Icon name="ph:paper-plane-right" class="w-5 h-5" />
              </div>
              <h2 class="text-xl font-bold text-text">Nouvelle Notification</h2>
            </div>
            <button @click="closeModal" class="p-2 text-textLight hover:bg-border/50 rounded-xl transition-colors">
              <Icon name="ph:x" class="w-5 h-5" />
            </button>
          </div>
          
          <div class="p-6 space-y-5">
            <div>
              <label class="block text-sm font-semibold text-text mb-2">Destinataire</label>
              <select v-model="form.user" class="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text transition-shadow">
                <option :value="null">🌍 Tous les utilisateurs (Global)</option>
                <option v-for="u in users" :key="u.id" :value="u.id">👤 {{ u.full_name || u.phone }} (ID: {{ u.id }})</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-text mb-2">Titre <span class="text-error">*</span></label>
              <input v-model="form.title" type="text" placeholder="Ex: Mise à jour, Offre spéciale..." class="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text transition-shadow" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-text mb-2">Message <span class="text-error">*</span></label>
              <textarea v-model="form.message" rows="4" placeholder="Contenu de la notification..." class="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text transition-shadow resize-none"></textarea>
            </div>
          </div>
          
          <div class="p-6 border-t border-border flex justify-end gap-3 bg-background/50">
            <button @click="closeModal" class="px-6 py-2.5 border border-border rounded-xl font-semibold text-text hover:bg-border/50 transition-colors">
              Annuler
            </button>
            <button @click="submitNotification" :disabled="isSending" class="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center shadow-sm shadow-primary/20">
              <Icon v-if="isSending" name="ph:spinner" class="animate-spin mr-2 w-5 h-5" />
              <Icon v-else name="ph:paper-plane-right" class="mr-2 w-5 h-5" />
              Envoyer la notification
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modale de Confirmation -->
    <AlertModal
      :show="showConfirm"
      title="Confirmation d'envoi"
      :message="confirmMessage"
      type="warning"
      confirmText="Oui, envoyer"
      cancelText="Annuler"
      :show-cancel="true"
      @confirm="handleConfirmSend"
      @close="showConfirm = false"
    />
    
    <!-- Modale de Suppression -->
    <AlertModal
      :show="showDeleteConfirm"
      title="Supprimer la notification"
      message="Êtes-vous sûr de vouloir supprimer cette notification ? Cette action est irréversible."
      type="error"
      confirmText="Supprimer"
      cancelText="Annuler"
      :show-cancel="true"
      @confirm="handleConfirmDelete"
      @close="showDeleteConfirm = false"
    />
    
    <!-- Viewer Notification (Voir) -->
    <Teleport to="body">
      <div v-if="viewingNotif" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="viewingNotif = null">
        <div class="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border p-6">
          <div class="flex justify-between items-start mb-6">
            <h3 class="text-xl font-bold text-text pr-4">{{ viewingNotif.title }}</h3>
            <button @click="viewingNotif = null" class="p-1 text-textMuted hover:text-text rounded-lg">
              <Icon name="ph:x" class="w-5 h-5" />
            </button>
          </div>
          <div class="space-y-4 mb-6">
            <p class="text-text whitespace-pre-wrap">{{ viewingNotif.message }}</p>
            <div class="bg-background/50 p-4 rounded-xl border border-border text-sm space-y-2">
              <div class="flex justify-between">
                <span class="text-textMuted font-medium">Destinataire:</span>
                <span class="text-text font-semibold">{{ viewingNotif.user ? getUserName(viewingNotif) : 'Tous les utilisateurs' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-textMuted font-medium">Date:</span>
                <span class="text-text font-semibold">{{ new Date(viewingNotif.created_at).toLocaleString('fr-FR') }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-textMuted font-medium">Statut:</span>
                <span class="text-text font-semibold" :class="viewingNotif.is_read ? 'text-success' : 'text-warning'">{{ viewingNotif.is_read ? 'Lue' : 'Non lue' }}</span>
              </div>
            </div>
          </div>
          <div class="flex justify-end">
            <button @click="viewingNotif = null" class="px-5 py-2 bg-background border border-border rounded-xl font-semibold hover:bg-border/50 transition-colors">Fermer</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'

// Import de la logique isolée dans le composable
const { notifications, users, pending, fetchNotifications, sendNotification, deleteNotification } = useNotifications()

// Toast System
const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })
function showToast(type: string, title: string, msg = '') {
  toast.type = type; toast.title = title; toast.message = msg; toast.show = true
}

// Filtres et Recherche
const search = ref('')
const filter = ref('all') // all, global, private, read, unread
const filterLabels: Record<string, string> = {
  all: 'Toutes',
  global: 'Globales',
  private: 'Privées',
  read: 'Lues',
  unread: 'Non lues'
}

// Pagination
const currentPage = ref(1)
const perPage = 10

const filteredNotifications = computed(() => {
  let result = notifications.value || []
  
  if (filter.value === 'global') result = result.filter(n => !n.user)
  if (filter.value === 'private') result = result.filter(n => n.user)
  if (filter.value === 'read') result = result.filter(n => n.is_read)
  if (filter.value === 'unread') result = result.filter(n => !n.is_read)
  
  if (search.value) {
    const s = search.value.toLowerCase()
    result = result.filter(n => 
      n.title?.toLowerCase().includes(s) || 
      n.message?.toLowerCase().includes(s)
    )
  }
  
  return result
})

const totalPages = computed(() => Math.ceil(filteredNotifications.value.length / perPage) || 1)

const paginatedNotifications = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredNotifications.value.slice(start, start + perPage)
})

// Réinitialise la pagination si la recherche/filtre change
watch([search, filter], () => {
  currentPage.value = 1
})

// Formulaire et Modale d'envoi
const isModalOpen = ref(false)
const isSending = ref(false)
const showConfirm = ref(false)
const confirmMessage = ref('')
const form = ref({ user: null, title: '', message: '' })

const resetForm = () => {
  form.value = { user: null, title: '', message: '' }
}

const openModal = () => {
  resetForm()
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitNotification = () => {
  if (!form.value.title.trim()) {
    return showToast('error', 'Erreur', 'Veuillez saisir un titre')
  }
  if (!form.value.message.trim()) {
    return showToast('error', 'Erreur', 'Veuillez saisir un message')
  }
  
  confirmMessage.value = form.value.user 
    ? "Voulez-vous vraiment envoyer cette notification privée ?" 
    : "Voulez-vous vraiment envoyer cette notification à TOUS les utilisateurs ?"
  showConfirm.value = true
}

const handleConfirmSend = async () => {
  showConfirm.value = false
  isSending.value = true
  
  try {
    await sendNotification(form.value)
    showToast('success', 'Succès', 'Notification envoyée avec succès.')
    closeModal()
    await fetchNotifications()
  } catch (err: any) {
    console.error(err)
    showToast('error', 'Erreur', err?.data?.detail || err?.message || "Une erreur est survenue lors de l'envoi.")
  } finally {
    isSending.value = false
  }
}

// Voir & Supprimer
const viewingNotif = ref<any>(null)
const viewNotification = (n: any) => {
  viewingNotif.value = n
}

const showDeleteConfirm = ref(false)
const notifToDelete = ref<number | null>(null)

const confirmDelete = (id: number) => {
  notifToDelete.value = id
  showDeleteConfirm.value = true
}

const handleConfirmDelete = async () => {
  if (!notifToDelete.value) return
  
  try {
    await deleteNotification(notifToDelete.value)
    showToast('success', 'Succès', 'Notification supprimée avec succès.')
    await fetchNotifications()
  } catch (err: any) {
    showToast('error', 'Erreur', 'Impossible de supprimer cette notification.')
  } finally {
    showDeleteConfirm.value = false
    notifToDelete.value = null
  }
}

const getUserName = (notif: any) => {
  if (notif.user_details) {
    return notif.user_details.full_name || notif.user_details.phone || notif.user_details.email || `Utilisateur #${notif.user}`
  }
  const u = users.value.find((usr: any) => usr.id === notif.user)
  if (u) {
    return u.full_name || u.phone || u.email || `Utilisateur #${notif.user}`
  }
  return `Utilisateur #${notif.user}`
}

// Time formatter
const timeAgo = (dateStr: string) => {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

onMounted(() => {
  fetchNotifications()
})
</script>
