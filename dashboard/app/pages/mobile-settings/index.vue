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

    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-text">Paramètres Mobile</h1>
      <p class="text-sm text-textLight mt-0.5">Gérez la configuration globale de l'application mobile</p>
    </div>

    <!-- Settings Card -->
    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm p-6">
      
      <!-- Promotions Setting -->
      <div class="flex items-center justify-between py-4">
        <div>
          <h2 class="text-lg font-semibold text-text">Section "Offres spéciales"</h2>
          <p class="text-sm text-textLight">Activer ou désactiver l'affichage du carrousel des promotions sur l'écran d'accueil de l'application mobile.</p>
        </div>
        
        <!-- Toggle Switch -->
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="settings.show_promotions" class="sr-only peer" @change="saveSettings">
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'

const { fetchApi } = useApi()

// --- State ---
const settings = reactive({
  show_promotions: true
})

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
async function fetchSettings() {
  try {
    const data = await fetchApi<any>('/mobile-settings/')
    if (data) {
      settings.show_promotions = data.show_promotions
    }
  } catch {
    showToast('error', 'Erreur', 'Impossible de récupérer les paramètres mobiles.')
  }
}

async function saveSettings() {
  try {
    await fetchApi('/mobile-settings/', {
      method: 'PUT',
      body: { show_promotions: settings.show_promotions }
    })
    showToast('success', 'Enregistré', 'Les paramètres mobiles ont été mis à jour avec succès.')
  } catch {
    showToast('error', 'Erreur', 'Impossible d\'enregistrer les paramètres mobiles.')
    // Revert state
    settings.show_promotions = !settings.show_promotions
  }
}

onMounted(fetchSettings)
</script>
