<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy.
Listing des paiements.

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

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text">Paiements</h1>
        <p class="text-sm text-textLight mt-0.5">{{ payments.length }} paiements enregistrés</p>
      </div>
      <div class="flex space-x-3">
        <button @click="exportExcel" class="inline-flex items-center px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 shadow-sm transition-colors">
          <Icon name="ph:file-xls" class="w-5 h-5 mr-2" />
          Export Excel
        </button>
        <button @click="exportPDF" class="inline-flex items-center px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-sm transition-colors">
          <Icon name="ph:file-pdf" class="w-5 h-5 mr-2" />
          Export PDF
        </button>
      </div>
    </div>

    <!-- Filtres -->
    <div class="bg-card rounded-xl border border-border p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <label class="block text-xs font-semibold text-textLight uppercase tracking-wider mb-2">Rechercher</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="ph:magnifying-glass" class="w-5 h-5 text-textMuted" />
          </div>
          <input
            v-model="filters.search"
            type="text"
            placeholder="ID Transaction, Téléphone..."
            class="pl-10 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
            @keyup.enter="fetchData"
          >
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-textLight uppercase tracking-wider mb-2">Statut</label>
        <select v-model="filters.status" class="w-full sm:w-48 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" @change="fetchData">
          <option value="">Tous les statuts</option>
          <option value="SUCCESS">Succès (SUCCESS)</option>
          <option value="PENDING">En attente (PENDING)</option>
          <option value="FAILED">Échoué (FAILED)</option>
          <option value="REFUNDED">Remboursé (REFUNDED)</option>
        </select>
      </div>
      <div class="flex items-end">
        <button @click="fetchData" class="w-full sm:w-auto px-4 py-2 bg-primary/10 text-primary font-medium rounded-lg hover:bg-primary/20 transition-colors">
          Filtrer
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/60 text-textLight">
            <tr>
              <th class="px-5 py-3 font-semibold">ID Transaction</th>
              <th class="px-5 py-3 font-semibold">Date</th>
              <th class="px-5 py-3 font-semibold">Utilisateur</th>
              <th class="px-5 py-3 font-semibold">Service</th>
              <th class="px-5 py-3 font-semibold text-right">Montant</th>
              <th class="px-5 py-3 font-semibold text-center">Statut</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending">
              <td colspan="6" class="py-10 text-center text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="payments.length === 0">
              <td colspan="6" class="py-10 text-center text-textMuted">Aucun paiement trouvé.</td>
            </tr>
            <tr v-for="payment in payments" :key="payment.id" class="hover:bg-background/30 transition-colors">
              <td class="px-5 py-4 font-mono text-xs text-text">{{ payment.transaction_id }}</td>
              <td class="px-5 py-4 text-textLight">{{ new Date(payment.created_at).toLocaleString() }}</td>
              <td class="px-5 py-4">
                <p class="font-medium text-text">{{ payment.user?.full_name || 'N/A' }}</p>
                <p class="text-xs text-textLight">{{ payment.user?.phone }}</p>
              </td>
              <td class="px-5 py-4">
                <span v-if="payment.booking" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg">
                  <Icon name="ph:car" class="w-3.5 h-3.5" /> Trajet
                </span>
                <span v-else-if="payment.parcel" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-lg">
                  <Icon name="ph:package" class="w-3.5 h-3.5" /> Colis
                </span>
                <span v-else class="text-textLight">Autre</span>
              </td>
              <td class="px-5 py-4 text-right font-semibold text-text">{{ payment.amount }} FCFA</td>
              <td class="px-5 py-4 text-center">
                <span 
                  class="px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="{
                    'bg-success/10 text-success': payment.status === 'SUCCESS',
                    'bg-warning/10 text-warningDark': payment.status === 'PENDING',
                    'bg-error/10 text-error': payment.status === 'FAILED',
                    'bg-textLight/10 text-textLight': payment.status === 'REFUNDED'
                  }"
                >
                  {{ payment.status }}
                </span>
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
const runtimeConfig = useRuntimeConfig()

const payments = ref<any[]>([])
const pending = ref(true)

const toast = reactive({ show: false, type: 'success' as any, title: '', message: '' })
const filters = reactive({ search: '', status: '' })

function showToast(type: string, title: string, msg = '') {
  toast.type = type; toast.title = title; toast.message = msg; toast.show = true
}

async function fetchData() {
  pending.value = true
  try {
    let url = '/payments/?'
    if (filters.search) url += `search=${encodeURIComponent(filters.search)}&`
    if (filters.status) url += `status=${encodeURIComponent(filters.status)}&`
    
    const res = await fetchApi<any>(url)
    payments.value = Array.isArray(res) ? res : res.results || []
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de charger les paiements.')
  } finally {
    pending.value = false
  }
}

function exportExcel() {
  let url = `${runtimeConfig.public.apiBase}/payments/export-excel/?`
  if (filters.search) url += `search=${encodeURIComponent(filters.search)}&`
  if (filters.status) url += `status=${encodeURIComponent(filters.status)}&`
  
  downloadBlob(url, 'paiements_zemy.xlsx')
}

function exportPDF() {
  let url = `${runtimeConfig.public.apiBase}/payments/export-pdf/?`
  if (filters.search) url += `search=${encodeURIComponent(filters.search)}&`
  if (filters.status) url += `status=${encodeURIComponent(filters.status)}&`
  
  downloadBlob(url, 'paiements_zemy.pdf')
}

async function downloadBlob(url: string, filename: string) {
  try {
    showToast('success', 'Export', 'Génération en cours...')
    const token = localStorage.getItem('token') || ''
    const headers: any = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error('Erreur réseau')
    
    const blob = await res.blob()
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(link.href)
  } catch (e) {
    showToast('error', 'Erreur', 'Impossible de générer l\'export.')
  }
}

onMounted(fetchData)
</script>
