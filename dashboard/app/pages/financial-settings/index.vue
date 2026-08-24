<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy.
Paramètres Financiers & Commissions — Layout à onglets.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <!-- HEADER -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">Paramètres Financiers</h1>
        <p class="text-textMuted mt-1">Gérez les commissions et la tarification de l'application Zemy.</p>
      </div>
      <button
        @click="saveSettings"
        :disabled="loading || !settings"
        class="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primaryDark transition-all shadow-sm disabled:opacity-50 w-fit self-start sm:self-auto"
      >
        <Icon v-if="loading" name="ph:spinner" class="w-4 h-4 animate-spin" />
        <Icon v-else name="ph:floppy-disk-bold" class="w-4 h-4" />
        <span>{{ loading ? 'Sauvegarde...' : 'Sauvegarder' }}</span>
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
      <Icon name="ph:warning-circle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p>{{ error }}</p>
    </div>

    <!-- Loading -->
    <div v-if="!settings && !error" class="bg-card rounded-2xl border border-border p-8 flex items-center justify-center min-h-64">
      <div class="flex flex-col items-center gap-3 text-textMuted">
        <Icon name="ph:spinner" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-sm">Chargement des paramètres...</p>
      </div>
    </div>

    <!-- TAB LAYOUT -->
    <div v-if="settings" class="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">

      <!-- Tab Nav -->
      <div class="border-b border-border bg-gray-50/60">
        <nav class="flex overflow-x-auto px-2 pt-2 gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            @click="activeTab = tab.key"
            class="relative flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap"
            :class="activeTab === tab.key
              ? 'bg-card text-primary border border-border border-b-card -mb-px shadow-sm'
              : 'text-textMuted hover:text-text hover:bg-gray-100'"
          >
            <Icon :name="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
            <span
              v-if="tab.key === 'trajets'"
              class="w-2 h-2 rounded-full flex-shrink-0"
              :class="settings.is_commission_active ? 'bg-green-400' : 'bg-gray-300'"
            />
            <span
              v-if="tab.key === 'colis'"
              class="w-2 h-2 rounded-full flex-shrink-0"
              :class="settings.is_parcel_commission_active ? 'bg-green-400' : 'bg-gray-300'"
            />
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6">

        <!-- ===== ONGLET: TRAJETS ===== -->
        <div v-show="activeTab === 'trajets'" class="space-y-6">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <h3 class="font-semibold text-text">Activer les commissions sur les trajets</h3>
              <p class="text-sm text-textMuted mt-0.5">Si désactivé, Zemy ne prendra aucune commission sur les trajets passagers.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input type="checkbox" v-model="settings.is_commission_active" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4" :class="{ 'opacity-40 pointer-events-none': !settings.is_commission_active }">
            <!-- Pourcentage -->
            <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="ph:percent" class="w-3.5 h-3.5 text-primary" />
                </div>
                <label class="text-sm font-semibold text-text">Pourcentage</label>
              </div>
              <div class="relative">
                <input v-model="settings.commission_percentage" type="number" step="0.1" min="0" max="100"
                  class="w-full bg-white border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-3 top-2.5 text-xs text-textLight">%</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in [5, 8, 10, 12, 15]" :key="v" type="button"
                  @click="settings.commission_percentage = v"
                  class="px-2 py-0.5 text-xs rounded-md border transition-all"
                  :class="settings.commission_percentage == v ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ v }}%
                </button>
              </div>
            </div>

            <!-- Minimum -->
            <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Icon name="ph:arrow-down" class="w-3.5 h-3.5 text-amber-500" />
                </div>
                <label class="text-sm font-semibold text-text">Minimum</label>
              </div>
              <div class="relative">
                <input v-model="settings.min_commission" type="number" min="0"
                  class="w-full bg-white border border-border rounded-lg px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-3 top-2.5 text-xs text-textLight">FCFA</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in [50, 100, 200, 500]" :key="v" type="button"
                  @click="settings.min_commission = v"
                  class="px-2 py-0.5 text-xs rounded-md border transition-all"
                  :class="settings.min_commission == v ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ v }}F
                </button>
              </div>
              <p class="text-xs text-textMuted">Montant minimal garanti.</p>
            </div>

            <!-- Maximum -->
            <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <Icon name="ph:arrow-up" class="w-3.5 h-3.5 text-green-500" />
                </div>
                <label class="text-sm font-semibold text-text">Maximum</label>
              </div>
              <div class="relative">
                <input v-model="settings.max_commission" type="number" min="0"
                  class="w-full bg-white border border-border rounded-lg px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-3 top-2.5 text-xs text-textLight">FCFA</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in [500, 1000, 2000, 5000]" :key="v" type="button"
                  @click="settings.max_commission = v"
                  class="px-2 py-0.5 text-xs rounded-md border transition-all"
                  :class="settings.max_commission == v ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ v }}F
                </button>
              </div>
              <p class="text-xs text-textMuted">Laisser 0 pour aucune limite.</p>
            </div>
          </div>

          <!-- Simulateur Trajets -->
          <div class="bg-primary/5 border border-primary/15 rounded-xl p-4">
            <p class="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Icon name="ph:calculator" class="w-3.5 h-3.5" />
              Simulateur — Payout conducteur : 1 000 FCFA
            </p>
            <div class="flex items-center gap-4 flex-wrap text-sm">
              <span>Commission : <strong class="text-primary font-mono">{{ simulatedCommission }} F</strong></span>
              <Icon name="ph:plus" class="w-3 h-3 text-textMuted" />
              <span>Payout : <strong class="font-mono">1 000 F</strong></span>
              <Icon name="ph:equals" class="w-3 h-3 text-textMuted" />
              <span class="font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg">
                {{ (1000 + simulatedCommission).toLocaleString('fr-FR') }} F payés par le passager
              </span>
            </div>
          </div>
        </div>

        <!-- ===== ONGLET: COLIS ===== -->
        <div v-show="activeTab === 'colis'" class="space-y-6">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <h3 class="font-semibold text-text">Activer les commissions sur les colis</h3>
              <p class="text-sm text-textMuted mt-0.5">Si désactivé, Zemy ne prendra aucune commission sur les colis.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input type="checkbox" v-model="settings.is_parcel_commission_active" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4" :class="{ 'opacity-40 pointer-events-none': !settings.is_parcel_commission_active }">
            <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="ph:percent" class="w-3.5 h-3.5 text-primary" />
                </div>
                <label class="text-sm font-semibold text-text">Pourcentage</label>
              </div>
              <div class="relative">
                <input v-model="settings.parcel_commission_percentage" type="number" step="0.1" min="0" max="100"
                  class="w-full bg-white border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-3 top-2.5 text-xs text-textLight">%</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in [5, 8, 10, 12, 15]" :key="v" type="button"
                  @click="settings.parcel_commission_percentage = v"
                  class="px-2 py-0.5 text-xs rounded-md border transition-all"
                  :class="settings.parcel_commission_percentage == v ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ v }}%
                </button>
              </div>
            </div>

            <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Icon name="ph:arrow-down" class="w-3.5 h-3.5 text-amber-500" />
                </div>
                <label class="text-sm font-semibold text-text">Minimum</label>
              </div>
              <div class="relative">
                <input v-model="settings.min_parcel_commission" type="number" min="0"
                  class="w-full bg-white border border-border rounded-lg px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-3 top-2.5 text-xs text-textLight">FCFA</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in [50, 100, 200, 500]" :key="v" type="button"
                  @click="settings.min_parcel_commission = v"
                  class="px-2 py-0.5 text-xs rounded-md border transition-all"
                  :class="settings.min_parcel_commission == v ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ v }}F
                </button>
              </div>
              <p class="text-xs text-textMuted">Montant minimal garanti.</p>
            </div>

            <div class="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <Icon name="ph:arrow-up" class="w-3.5 h-3.5 text-green-500" />
                </div>
                <label class="text-sm font-semibold text-text">Maximum</label>
              </div>
              <div class="relative">
                <input v-model="settings.max_parcel_commission" type="number" min="0"
                  class="w-full bg-white border border-border rounded-lg px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-3 top-2.5 text-xs text-textLight">FCFA</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in [500, 1000, 2000, 5000]" :key="v" type="button"
                  @click="settings.max_parcel_commission = v"
                  class="px-2 py-0.5 text-xs rounded-md border transition-all"
                  :class="settings.max_parcel_commission == v ? 'bg-primary text-white border-primary' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ v }}F
                </button>
              </div>
              <p class="text-xs text-textMuted">Laisser 0 pour aucune limite.</p>
            </div>
          </div>

          <!-- Simulateur Colis -->
          <div class="bg-primary/5 border border-primary/15 rounded-xl p-4">
            <p class="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Icon name="ph:calculator" class="w-3.5 h-3.5" />
              Simulateur — Valeur colis : 1 000 FCFA
            </p>
            <div class="flex items-center gap-4 flex-wrap text-sm">
              <span>Commission : <strong class="text-primary font-mono">{{ simulatedParcelCommission }} F</strong></span>
              <Icon name="ph:plus" class="w-3 h-3 text-textMuted" />
              <span>Valeur : <strong class="font-mono">1 000 F</strong></span>
              <Icon name="ph:equals" class="w-3 h-3 text-textMuted" />
              <span class="font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg">
                {{ (1000 + simulatedParcelCommission).toLocaleString('fr-FR') }} F payés par l'expéditeur
              </span>
            </div>
          </div>
        </div>

        <!-- ===== ONGLET: PRIX CONSEILLÉ ===== -->
        <div v-show="activeTab === 'prix'" class="space-y-6">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
            <Icon name="ph:info" class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-blue-800">
              Ces paramètres définissent le <strong>prix suggéré</strong> affiché aux conducteurs lors de la publication d'un trajet.
              L'application mobile utilise exclusivement ces valeurs — aucun algorithme local n'est actif.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Prix / km -->
            <div class="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="ph:road-horizon" class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-bold text-text text-sm">Prix par kilomètre</h3>
                  <p class="text-xs text-textMuted">Taux de base utilisé pour le calcul</p>
                </div>
              </div>
              <div class="relative">
                <input v-model="settings.price_per_km" type="number" min="0"
                  class="w-full bg-white border border-border rounded-xl px-4 py-3 pr-16 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-4 top-3.5 text-sm text-textLight font-medium">FCFA</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="p in [10, 15, 20, 25, 30, 40, 50, 100]" :key="p" type="button"
                  @click="settings.price_per_km = p"
                  class="px-3 py-1 text-xs font-semibold rounded-lg border transition-all"
                  :class="settings.price_per_km === p ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ p }} F
                </button>
              </div>
              <p class="text-xs text-textMuted">Formule : prix_conseillé = distance_km × tarif/km</p>
            </div>

            <!-- Marge -->
            <div class="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Icon name="ph:arrows-out-line-horizontal" class="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 class="font-bold text-text text-sm">Marge autorisée</h3>
                  <p class="text-xs text-textMuted">Fourchette min / max autour du conseillé</p>
                </div>
              </div>
              <div class="relative">
                <input v-model="settings.price_margin_percent" type="number" min="0" max="100"
                  class="w-full bg-white border border-border rounded-xl px-4 py-3 pr-10 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span class="absolute right-4 top-3.5 text-sm text-textLight font-medium">%</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="m in [10, 15, 20, 25, 30]" :key="m" type="button"
                  @click="settings.price_margin_percent = m"
                  class="px-3 py-1 text-xs font-semibold rounded-lg border transition-all"
                  :class="settings.price_margin_percent === m ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-textMuted border-border hover:bg-gray-50'">
                  {{ m }}%
                </button>
              </div>
              <p class="text-xs text-textMuted">Min = conseillé × (1 − marge%) · Max = conseillé × (1 + marge%)</p>
            </div>
          </div>

          <!-- Prévisualisation dynamique -->
          <div class="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <p class="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="ph:chart-bar" class="w-3.5 h-3.5" />
                Prévisualisation des prix
              </p>
              <span class="text-sm font-bold text-text bg-white border border-border rounded-lg px-3 py-1">{{ previewDist }} km</span>
            </div>
            <input type="range" v-model="previewDist" min="10" max="500" step="10" class="w-full accent-primary" />
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-white rounded-xl border border-red-100 p-3 text-center">
                <p class="text-xs text-textMuted font-medium mb-1">Minimum</p>
                <p class="text-xl font-black text-red-500">{{ previewMin.toLocaleString('fr-FR') }}</p>
                <p class="text-xs text-textMuted">FCFA</p>
              </div>
              <div class="bg-white rounded-xl border border-primary/30 p-3 text-center ring-2 ring-primary/20">
                <p class="text-xs text-primary font-bold mb-1 uppercase tracking-wide">Conseillé ✦</p>
                <p class="text-xl font-black text-primary">{{ previewSuggested.toLocaleString('fr-FR') }}</p>
                <p class="text-xs text-textMuted">FCFA</p>
              </div>
              <div class="bg-white rounded-xl border border-green-100 p-3 text-center">
                <p class="text-xs text-textMuted font-medium mb-1">Maximum</p>
                <p class="text-xl font-black text-green-600">{{ previewMax.toLocaleString('fr-FR') }}</p>
                <p class="text-xs text-textMuted">FCFA</p>
              </div>
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

const activeTab = ref<'trajets' | 'colis' | 'prix'>('trajets')
const tabs: { key: 'trajets' | 'colis' | 'prix'; label: string; icon: string }[] = [
  { key: 'trajets', label: 'Commissions Trajets', icon: 'ph:car' },
  { key: 'colis', label: 'Commissions Colis', icon: 'ph:package' },
  { key: 'prix', label: 'Prix Conseillé', icon: 'ph:currency-circle-dollar' },
]

const previewDist = ref(100)

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
  price_margin_percent: number;
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
      settings.value = {
        is_commission_active: true,
        commission_percentage: 10,
        min_commission: 100,
        max_commission: null,
        is_parcel_commission_active: true,
        parcel_commission_percentage: 8,
        min_parcel_commission: 100,
        max_parcel_commission: null,
        price_per_km: 30,
        price_margin_percent: 20
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

const previewSuggested = computed(() => {
  if (!settings.value) return 0
  return Math.round((previewDist.value * settings.value.price_per_km) / 100) * 100
})
const previewMin = computed(() => {
  if (!settings.value) return 0
  return Math.round(previewSuggested.value * (1 - settings.value.price_margin_percent / 100) / 100) * 100
})
const previewMax = computed(() => {
  if (!settings.value) return 0
  return Math.round(previewSuggested.value * (1 + settings.value.price_margin_percent / 100) / 100) * 100
})

async function saveSettings() {
  if (!settings.value) return
  loading.value = true
  error.value = ''
  try {
    await fetchApi('/financial-settings/1/', { method: 'PUT', body: settings.value })
    showToast('success', 'Sauvegardé', 'Les paramètres financiers ont été sauvegardés avec succès.')
  } catch (err: any) {
    if (err.status === 404 || err.message?.includes('404')) {
      try {
        await fetchApi('/financial-settings/', { method: 'POST', body: { id: 1, ...settings.value } })
        showToast('success', 'Créé', 'Les paramètres financiers ont été créés avec succès.')
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
