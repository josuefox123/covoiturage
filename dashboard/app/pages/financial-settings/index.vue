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
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">Paramètres Financiers & Commissions</h1>
        <p class="text-textMuted mt-1">Gerez le calcul des commissions de l'application Zemy.</p>
      </div>
      <button
        @click="saveSettings"
        :disabled="loading"
        class="bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primaryDark transition-colors shadow-sm disabled:opacity-50 w-fit self-start sm:self-auto"
      >
        <span v-if="loading">Sauvegarde...</span>
        <span v-else>Sauvegarder</span>
      </button>
    </div>

    <div v-if="error" class="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-start gap-3">
      <Icon name="ph:warning-circle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p>{{ error }}</p>
    </div>

    <div v-if="settings" class="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <div class="p-6 space-y-6">
        <!-- TRAJETS (PASSAGERS) -->
        <h2 class="text-lg font-bold text-text">Commissions sur les Trajets</h2>
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <h3 class="font-semibold text-text">Activer les commissions</h3>
            <p class="text-sm text-textMuted">Si désactivé, l'application ne prendra aucune commission sur les trajets.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="settings.is_commission_active" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6" :class="{ 'opacity-50 pointer-events-none': !settings.is_commission_active }">
          
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-text">Pourcentage de commission (%)</label>
            <div class="relative">
              <input
                v-model="settings.commission_percentage"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">%</span>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-semibold text-text">Commission minimum (FCFA)</label>
            <div class="relative">
              <input
                v-model="settings.min_commission"
                type="number"
                min="0"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">FCFA</span>
            </div>
            <p class="text-xs text-textMuted">Garantit un montant minimal même pour les petits trajets.</p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-semibold text-text">Commission maximum (FCFA)</label>
            <div class="relative">
              <input
                v-model="settings.max_commission"
                type="number"
                min="0"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">FCFA</span>
            </div>
            <p class="text-xs text-textMuted">Laissez à 0 ou vide pour aucune limite.</p>
          </div>
          
        </div>

        <div class="my-8 border-t border-gray-200"></div>

        <!-- ESTIMATION PRIX (TRAJETS) -->
        <h2 class="text-lg font-bold text-text">Recommandation de Prix (Trajets)</h2>
        <div class="bg-gray-50 rounded-xl border border-gray-100 p-6 space-y-4">
          <div class="space-y-2 max-w-sm">
            <label class="block text-sm font-semibold text-text">Prix par kilomètre (FCFA/km)</label>
            <div class="relative">
              <input
                v-model="settings.price_per_km"
                type="number"
                min="0"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">FCFA</span>
            </div>
            <p class="text-xs text-textMuted">Valeur utilisée pour recommander un prix au conducteur lors de la publication d'un trajet.</p>
          </div>
        </div>

        <div class="my-8 border-t border-gray-200"></div>

        <!-- COLIS -->
        <h2 class="text-lg font-bold text-text">Commissions sur les Colis</h2>
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <h3 class="font-semibold text-text">Activer les commissions (Colis)</h3>
            <p class="text-sm text-textMuted">Si désactivé, l'application ne prendra aucune commission sur les colis.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="settings.is_parcel_commission_active" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6" :class="{ 'opacity-50 pointer-events-none': !settings.is_parcel_commission_active }">
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-text">Pourcentage de commission (%)</label>
            <div class="relative">
              <input
                v-model="settings.parcel_commission_percentage"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">%</span>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-semibold text-text">Commission minimum (FCFA)</label>
            <div class="relative">
              <input
                v-model="settings.min_parcel_commission"
                type="number"
                min="0"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">FCFA</span>
            </div>
            <p class="text-xs text-textMuted">Garantit un montant minimal même pour les petits colis.</p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-semibold text-text">Commission maximum (FCFA)</label>
            <div class="relative">
              <input
                v-model="settings.max_parcel_commission"
                type="number"
                min="0"
                class="w-full bg-white border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span class="absolute right-4 top-3 text-textLight">FCFA</span>
            </div>
            <p class="text-xs text-textMuted">Laissez à 0 ou vide pour aucune limite.</p>
          </div>
        </div>

      </div>
      
      <div class="bg-primaryLight/30 p-6 border-t border-border">
        <h3 class="font-semibold text-primaryDark mb-2 flex items-center gap-2">
          <Icon name="ph:info" class="w-5 h-5" />
          Exemple de calcul
        </h3>
        <div class="text-sm text-text space-y-2">
          <p>Prix saisi par le conducteur : <strong class="font-mono">1000 FCFA</strong></p>
          <div class="grid grid-cols-2 gap-4 mt-2">
            <div class="p-3 bg-white rounded-lg border border-border">
              <p class="font-semibold text-xs text-textLight uppercase tracking-wider mb-1">Passager</p>
              <p>Commission calculée : <strong class="font-mono text-primary">{{ simulatedCommission }} FCFA</strong></p>
              <p>Total payé : <strong class="font-mono text-success">{{ 1000 + simulatedCommission }} FCFA</strong></p>
            </div>
            <div class="p-3 bg-white rounded-lg border border-border">
              <p class="font-semibold text-xs text-textLight uppercase tracking-wider mb-1">Colis</p>
              <p>Commission calculée : <strong class="font-mono text-primary">{{ simulatedParcelCommission }} FCFA</strong></p>
              <p>Total payé : <strong class="font-mono text-success">{{ 1000 + simulatedParcelCommission }} FCFA</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'

const { fetchApi } = useApi()

// Toast
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

interface FinSettings {
  is_commission_active: boolean;
  commission_percentage: number;
  min_commission: number;
  max_commission: number | null;
  is_parcel_commission_active: boolean;
  parcel_commission_percentage: number;
  min_parcel_commission: number;
  max_parcel_commission: number | null;
  price_per_km: number;
}

const settings = ref<FinSettings | null>(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const data = await fetchApi('/financial-settings/1/')
    settings.value = data
  } catch (err: any) {
    if (err.message?.includes('404')) {
      // If setting 1 doesn't exist, create it or fallback to defaults
      settings.value = {
        is_commission_active: true,
        commission_percentage: 10,
        min_commission: 100,
        max_commission: null,
        is_parcel_commission_active: true,
        parcel_commission_percentage: 8,
        min_parcel_commission: 100,
        max_parcel_commission: null,
        price_per_km: 30
      }
    } else {
      error.value = "Impossible de charger les paramètres financiers."
    }
  }
})

const simulatedCommission = computed(() => {
  if (!settings.value || !settings.value.is_commission_active) return 0
  let comm = Math.floor(1000 * (settings.value.commission_percentage / 100))
  if (comm < settings.value.min_commission) comm = settings.value.min_commission
  if (settings.value.max_commission && comm > settings.value.max_commission) comm = settings.value.max_commission
  return comm
})

const simulatedParcelCommission = computed(() => {
  if (!settings.value || !settings.value.is_parcel_commission_active) return 0
  let comm = Math.floor(1000 * (settings.value.parcel_commission_percentage / 100))
  if (comm < settings.value.min_parcel_commission) comm = settings.value.min_parcel_commission
  if (settings.value.max_parcel_commission && comm > settings.value.max_parcel_commission) comm = settings.value.max_parcel_commission
  return comm
})

async function saveSettings() {
  if (!settings.value) return
  loading.value = true
  error.value = ''
  
  try {
    // Attempt PUT first; if 404, create via POST
    await fetchApi('/financial-settings/1/', {
      method: 'PUT',
      body: settings.value
    })
    showToast('success', 'Sauvegardé', 'Les paramètres financiers ont été sauvegardés avec succès.')
  } catch (err: any) {
    if (err.status === 404 || err.message?.includes('404')) {
      try {
        await fetchApi('/financial-settings/', {
          method: 'POST',
          body: { id: 1, ...settings.value }
        })
        showToast('success', 'Créé', 'Les paramètres financiers ont été créés et sauvegardés avec succès.')
      } catch (e: any) {
        error.value = e.message || 'Erreur lors de la sauvegarde.'
        showToast('error', 'Erreur', error.value)
      }
    } else {
      error.value = err.message || 'Erreur lors de la sauvegarde.'
      showToast('error', 'Erreur', error.value)
    }
  } finally {
    loading.value = false
  }
}
</script>
