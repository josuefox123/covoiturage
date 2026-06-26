<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-text flex items-center gap-2">
          <Icon name="ph:ticket-bold" class="w-6 h-6 text-primary" />
          <span>Tickets de Support</span>
        </h1>
        <p class="text-textMuted mt-1">Consultez et répondez aux messages de support envoyés par les utilisateurs.</p>
      </div>
      <button 
        @click="fetchTickets" 
        class="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-textLight hover:text-primary transition-colors text-sm font-medium"
      >
        <Icon name="ph:arrows-clockwise" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        <span>Actualiser</span>
      </button>
    </div>

    <!-- Filters & Search -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
      <!-- Search -->
      <div class="relative">
        <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher (nom, email, sujet...)"
          class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      <!-- Filter Category -->
      <div>
        <select
          v-model="filterCategory"
          class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        >
          <option value="">Toutes les catégories</option>
          <option value="problem_ride">Problème de trajet</option>
          <option value="problem_parcel">Problème de colis</option>
          <option value="payment">Paiement</option>
          <option value="account">Compte</option>
          <option value="driver">Conducteur</option>
          <option value="suggestion">Suggestion</option>
          <option value="other">Autre</option>
        </select>
      </div>

      <!-- Filter Status -->
      <div>
        <select
          v-model="filterStatus"
          class="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        >
          <option value="">Tous les statuts</option>
          <option value="new">Nouveaux (Non résolus)</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Traités (Résolus)</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50/50 border-b border-border text-textMuted font-semibold">
            <tr>
              <th class="px-6 py-4">Numéro</th>
              <th class="px-6 py-4">Utilisateur</th>
              <th class="px-6 py-4">Catégorie</th>
              <th class="px-6 py-4">Sujet</th>
              <th class="px-6 py-4">Date</th>
              <th class="px-6 py-4">Statut</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="loading && tickets.length === 0">
              <td colspan="7" class="px-6 py-12 text-center text-textMuted">
                <Icon name="ph:spinner" class="animate-spin w-8 h-8 mx-auto text-primary mb-2" />
                <span>Chargement des tickets...</span>
              </td>
            </tr>
            <tr v-else-if="filteredTickets.length === 0">
              <td colspan="7" class="px-6 py-12 text-center text-textMuted">
                <Icon name="ph:ticket-slash" class="w-10 h-10 mx-auto text-textMuted/40 mb-2" />
                <span>Aucun ticket trouvé</span>
              </td>
            </tr>
            <tr v-for="ticket in filteredTickets" :key="ticket.id" class="hover:bg-gray-50/50 transition-colors">
              <!-- Ticket Number -->
              <td class="px-6 py-4 font-semibold text-primary font-mono text-xs">
                {{ ticket.ticket_number || 'N/A' }}
              </td>
              <!-- User -->
              <td class="px-6 py-4">
                <div class="flex flex-col">
                  <span class="font-medium text-text">{{ ticket.name }}</span>
                  <span class="text-xs text-textMuted">{{ ticket.email }}</span>
                </div>
              </td>
              <!-- Category -->
              <td class="px-6 py-4">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {{ getCategoryLabel(ticket.category) }}
                </span>
              </td>
              <!-- Subject -->
              <td class="px-6 py-4 text-text truncate max-w-[200px]" :title="ticket.subject">
                {{ ticket.subject }}
              </td>
              <!-- Date -->
              <td class="px-6 py-4 text-textMuted">
                {{ formatDate(ticket.created_at) }}
              </td>
              <!-- Status -->
              <td class="px-6 py-4">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-blue-100 text-blue-800': ticket.status === 'new',
                    'bg-warning/10 text-warningDark': ticket.status === 'in_progress',
                    'bg-success/10 text-success': ticket.status === 'resolved',
                  }"
                >
                  {{ getStatusLabel(ticket.status) }}
                </span>
              </td>
              <!-- Actions -->
              <td class="px-6 py-4 text-right">
                <button
                  @click="openTicket(ticket)"
                  class="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 ml-auto"
                >
                  <Icon name="ph:chat-teardrop-text" class="w-4 h-4" />
                  <span>Répondre / Voir</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detail & Reply -->
    <div 
      v-if="activeTicket" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div class="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-gray-50/50">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-bold text-primary">{{ activeTicket.ticket_number }}</span>
            <span class="text-xs text-textMuted">•</span>
            <span class="text-sm font-semibold">{{ getCategoryLabel(activeTicket.category) }}</span>
          </div>
          <button @click="closeTicket" class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <Icon name="ph:x" class="w-5 h-5 text-textLight" />
          </button>
        </div>

        <!-- Modal Scrollable Content -->
        <div class="p-6 space-y-4 overflow-y-auto flex-1">
          <!-- Metadata grid -->
          <div class="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-border/60">
            <div>
              <span class="text-textMuted text-xs block mb-0.5">Expéditeur</span>
              <span class="font-medium text-text block">{{ activeTicket.name }}</span>
              <span class="text-textMuted text-xs block">{{ activeTicket.email }}</span>
            </div>
            <div>
              <span class="text-textMuted text-xs block mb-0.5">Reçu le</span>
              <span class="text-text block">{{ formatDate(activeTicket.created_at) }}</span>
              <span v-if="activeTicket.ip_address" class="text-textMuted text-xs block">IP: {{ activeTicket.ip_address }}</span>
            </div>
          </div>

          <!-- Subject -->
          <div>
            <h4 class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">Sujet de la demande</h4>
            <p class="text-base font-bold text-text">{{ activeTicket.subject }}</p>
          </div>

          <!-- Message -->
          <div>
            <h4 class="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">Message de l'utilisateur</h4>
            <div class="bg-slate-50 border border-border rounded-xl p-4 text-sm text-text whitespace-pre-wrap leading-relaxed shadow-inner">
              {{ activeTicket.message }}
            </div>
          </div>

          <hr class="border-border" />

          <!-- Reply form -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-textMuted uppercase tracking-wider block">Répondre par e-mail</label>
              
              <!-- Quick Status Update inside Modal -->
              <div class="flex items-center gap-2">
                <span class="text-xs text-textMuted">Statut :</span>
                <select
                  v-model="activeTicket.status"
                  @change="updateStatus(activeTicket.id, activeTicket.status)"
                  class="text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="new">Nouveau</option>
                  <option value="in_progress">En cours</option>
                  <option value="resolved">Traité</option>
                </select>
              </div>
            </div>
            <textarea
              v-model="replyText"
              rows="5"
              placeholder="Saisissez votre réponse ici. Un email automatique sera envoyé à l'utilisateur..."
              class="w-full p-4 border border-border rounded-xl bg-background text-sm text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:shadow-sm"
              :disabled="sendingReply"
            ></textarea>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-gray-50/50">
          <button
            @click="closeTicket"
            class="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
            :disabled="sendingReply"
          >
            Annuler
          </button>
          <button
            @click="sendReply"
            class="px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primaryDark transition-colors flex items-center gap-2 shadow-md shadow-primary/20"
            :disabled="sendingReply || !replyText.trim()"
          >
            <Icon v-if="sendingReply" name="ph:spinner" class="animate-spin w-4 h-4" />
            <Icon v-else name="ph:paper-plane" class="w-4 h-4" />
            <span>Envoyer la réponse</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  layout: 'default',
})

useHead({ title: 'Tickets Support — Zemy' })

const { fetchApi } = useApi()

const tickets = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const filterCategory = ref('')
const filterStatus = ref('')

const activeTicket = ref<any | null>(null)
const replyText = ref('')
const sendingReply = ref(false)

onMounted(() => {
  fetchTickets()
})

async function fetchTickets() {
  loading.value = true
  try {
    const data = await fetchApi('/support-tickets/')
    tickets.value = Array.isArray(data) ? data : data.results || []
  } catch (error) {
    console.error('Erreur lors de la récupération des tickets:', error)
  } finally {
    loading.value = false
  }
}

const filteredTickets = computed(() => {
  let list = tickets.value
  
  // Search text query
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    list = list.filter(t => 
      (t.ticket_number && t.ticket_number.toLowerCase().includes(q)) ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.message && t.message.toLowerCase().includes(q))
    )
  }

  // Filter by category
  if (filterCategory.value) {
    list = list.filter(t => t.category === filterCategory.value)
  }

  // Filter by status
  if (filterStatus.value) {
    list = list.filter(t => t.status === filterStatus.value)
  }

  return list
})

function getCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    'problem_ride': 'Problème de trajet',
    'problem_parcel': 'Problème de colis',
    'payment': 'Paiement',
    'account': 'Compte',
    'driver': 'Conducteur',
    'suggestion': 'Suggestion',
    'other': 'Autre'
  }
  return map[cat] || cat
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    'new': 'Nouveau',
    'in_progress': 'En cours',
    'resolved': 'Traité'
  }
  return map[status] || status
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function openTicket(ticket: any) {
  activeTicket.value = JSON.parse(JSON.stringify(ticket)) // Deep clone
  replyText.value = ''
}

function closeTicket() {
  activeTicket.value = null
  replyText.value = ''
}

async function updateStatus(id: string, newStatus: string) {
  try {
    await fetchApi(`/support-tickets/${id}/`, {
      method: 'PATCH',
      body: { status: newStatus }
    })
    // Update local list
    const index = tickets.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tickets.value[index].status = newStatus
    }
  } catch (error: any) {
    alert("Erreur lors de la mise à jour du statut : " + (error.message || ''))
  }
}

async function sendReply() {
  if (!activeTicket.value || !replyText.value.trim()) return
  
  sendingReply.value = true
  try {
    await fetchApi(`/support-tickets/${activeTicket.value.id}/reply/`, {
      method: 'POST',
      body: { message: replyText.value.trim() }
    })
    
    alert("Votre réponse a été envoyée par e-mail à l'utilisateur avec succès.")
    
    // Refresh tickets to reflect updated status ('resolved')
    await fetchTickets()
    closeTicket()
  } catch (error: any) {
    alert("Impossible d'envoyer la réponse : " + (error.message || ''))
  } finally {
    sendingReply.value = false
  }
}
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
</style>
