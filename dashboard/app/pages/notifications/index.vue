<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-text">Notifications</h1>
      <button @click="openModal" class="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors flex items-center">
        <Icon name="ph:paper-plane-right" class="mr-2" />
        Envoyer une notification
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="bg-card rounded-xl p-6 border border-border shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-textMuted mb-1">Total envoyées</p>
            <h3 class="text-2xl font-bold text-text">{{ notifications.length }}</h3>
          </div>
          <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Icon name="ph:megaphone" class="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="p-4 border-b border-border font-bold text-text">
        Historique des notifications
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/50 text-textLight">
            <tr>
              <th class="px-6 py-3 font-semibold">Date</th>
              <th class="px-6 py-3 font-semibold">Destinataire</th>
              <th class="px-6 py-3 font-semibold">Titre</th>
              <th class="px-6 py-3 font-semibold">Message</th>
              <th class="px-6 py-3 font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending" class="text-center py-10">
              <td colspan="5" class="py-10 text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="notifications.length === 0" class="text-center py-10">
              <td colspan="5" class="py-10 text-textMuted">Aucune notification envoyée.</td>
            </tr>
            <tr v-for="notif in notifications" :key="notif.id" class="hover:bg-background/30 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <p class="font-medium text-text">{{ new Date(notif.created_at).toLocaleDateString('fr-FR') }}</p>
                <p class="text-xs text-textMuted">{{ new Date(notif.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) }}</p>
              </td>
              <td class="px-6 py-4">
                <span v-if="!notif.user" class="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-md font-semibold">Tous les utilisateurs</span>
                <span v-else class="text-text font-medium">ID: {{ notif.user }}</span>
              </td>
              <td class="px-6 py-4 font-semibold text-text">{{ notif.title }}</td>
              <td class="px-6 py-4 text-textLight max-w-xs truncate" :title="notif.message">{{ notif.message }}</td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs font-medium rounded-full" :class="notif.is_read ? 'bg-success/10 text-success' : 'bg-warning/10 text-warningDark'">
                  {{ notif.is_read ? 'Lue' : 'Non lue' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Send Notification Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-card rounded-xl border border-border shadow-lg w-full max-w-lg overflow-hidden">
        <div class="p-4 border-b border-border flex justify-between items-center">
          <h2 class="text-lg font-bold text-text">Nouvelle Notification</h2>
          <button @click="closeModal" class="text-textLight hover:text-error transition-colors">
            <Icon name="ph:x" class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-text mb-1">Destinataire</label>
            <select v-model="form.user" class="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text">
              <option :value="null">Tous les utilisateurs (Global)</option>
              <!-- Chargement de la liste des utilisateurs -->
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name || u.phone }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Titre</label>
            <input v-model="form.title" type="text" placeholder="Ex: Mise à jour, Offre spéciale..." class="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Message</label>
            <textarea v-model="form.message" rows="4" placeholder="Contenu de la notification..." class="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text"></textarea>
          </div>
        </div>
        <div class="p-4 border-t border-border flex justify-end space-x-3 bg-background/50">
          <button @click="closeModal" class="px-4 py-2 border border-border rounded-lg font-medium text-textLight hover:text-text hover:bg-border/50 transition-colors">
            Annuler
          </button>
          <button @click="sendNotification" :disabled="isSending || !form.title || !form.message" class="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center">
            <Icon v-if="isSending" name="ph:spinner" class="animate-spin mr-2" />
            <Icon v-else name="ph:paper-plane-right" class="mr-2" />
            Envoyer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const { fetchApi } = useApi()
const notifications = ref<any[]>([])
const users = ref<any[]>([])
const pending = ref(true)

const isModalOpen = ref(false)
const isSending = ref(false)
const form = ref({
  user: null,
  title: '',
  message: ''
})

const openModal = () => {
  form.value = { user: null, title: '', message: '' }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const fetchNotifications = async () => {
  pending.value = true
  try {
    const [notifData, userData] = await Promise.all([
      fetchApi<any[]>('/notifications/'),
      fetchApi<any[]>('/users/')
    ])
    notifications.value = Array.isArray(notifData) ? notifData : (notifData as any).results || []
    users.value = Array.isArray(userData) ? userData : (userData as any).results || []
  } catch (err) {
    console.error('Erreur', err)
  } finally {
    pending.value = false
  }
}

const sendNotification = async () => {
  if (!form.value.title || !form.value.message) return
  
  isSending.value = true
  try {
    await fetchApi('/notifications/', {
      method: 'POST',
      body: form.value
    })
    closeModal()
    fetchNotifications() // Reload list
  } catch (err) {
    console.error('Erreur lors de lenvoi', err)
    alert("Impossible d'envoyer la notification")
  } finally {
    isSending.value = false
  }
}

onMounted(() => {
  fetchNotifications()
})
</script>
