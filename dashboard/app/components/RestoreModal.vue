<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-card w-full max-w-md p-6 rounded-2xl shadow-xl">
      <h3 class="text-xl font-bold mb-4 text-text">Restaurer l'utilisateur</h3>
      <p class="text-sm text-textMuted mb-6">
        Vous allez restaurer le compte de <strong>{{ user?.full_name || user?.phone }}</strong>. Il pourra de nouveau se connecter à l'application et utiliser ses services.
      </p>
      <div class="flex justify-end gap-3">
        <button @click="$emit('close')" class="px-4 py-2 rounded-lg text-text hover:bg-background transition-colors font-medium">
          Annuler
        </button>
        <button @click="$emit('confirm')" class="px-4 py-2 rounded-lg bg-success text-white hover:bg-success-dark transition-colors font-medium shadow-sm">
          Restaurer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  user: any
}>()

defineEmits(['close', 'confirm'])
</script>
