<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-card w-full max-w-md p-6 rounded-2xl shadow-xl border border-error/20">
      <div class="flex items-center gap-3 text-error mb-4">
        <Icon name="ph:warning-circle" class="w-8 h-8" />
        <h3 class="text-xl font-bold">Suppression définitive</h3>
      </div>
      
      <p class="text-sm text-text mb-4">
        Cette action est <strong class="text-error">irréversible</strong>.
        Toutes les données de <strong>{{ user?.full_name || user?.phone }}</strong> seront détruites de la base de données.
      </p>

      <div class="mb-6">
        <label class="block text-sm font-medium text-text mb-2">
          Tapez <strong class="text-error select-all">SUPPRIMER</strong> pour confirmer.
        </label>
        <input
          v-model="validation"
          type="text"
          class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-error/20 focus:border-error bg-background text-text"
          placeholder="SUPPRIMER"
        />
      </div>

      <div class="flex justify-end gap-3">
        <button @click="$emit('close')" class="px-4 py-2 rounded-lg text-text hover:bg-background transition-colors font-medium">
          Annuler
        </button>
        <button 
          @click="confirm" 
          :disabled="validation !== 'SUPPRIMER'"
          class="px-4 py-2 rounded-lg bg-error text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          Supprimer définitivement
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  user: any
}>()

const emit = defineEmits(['close', 'confirm'])

const validation = ref('')

watch(() => props.show, (val) => {
  if (val) validation.value = ''
})

function confirm() {
  if (validation.value === 'SUPPRIMER') {
    emit('confirm')
  }
}
</script>
