<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-card w-full max-w-md p-6 rounded-2xl shadow-xl">
      <h3 class="text-xl font-bold mb-4 text-text">Archiver l'utilisateur</h3>
      <p class="text-sm text-textMuted mb-4">
        Vous êtes sur le point d'archiver {{ user?.full_name || user?.phone }}.
        Cet utilisateur ne pourra plus se connecter et ses trajets en cours seront annulés.
      </p>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-text mb-1">Motif de l'archivage (optionnel)</label>
        <textarea
          v-model="reason"
          class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-text"
          rows="3"
          placeholder="Ex: Non respect des conditions..."
        ></textarea>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button @click="$emit('close')" class="px-4 py-2 rounded-lg text-text hover:bg-background transition-colors font-medium">
          Annuler
        </button>
        <button @click="confirm" class="px-4 py-2 rounded-lg bg-warning text-white hover:bg-warning-dark transition-colors font-medium shadow-sm">
          Archiver
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

const reason = ref('')

watch(() => props.show, (val) => {
  if (val) reason.value = ''
})

function confirm() {
  emit('confirm', reason.value)
}
</script>
