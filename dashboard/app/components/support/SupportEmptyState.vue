<!--
==========================================================
Fichier :
SupportEmptyState.vue

Description :
Composant d'affichage d'un état vide ou d'erreur dans le Centre de Support.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
    <div class="w-16 h-16 rounded-full bg-background flex items-center justify-center border border-border">
      <Icon 
        :name="error ? 'ph:warning-circle' : 'ph:chat-slash'" 
        class="w-8 h-8" 
        :class="error ? 'text-error animate-bounce' : 'text-textMuted/60'" 
      />
    </div>
    <div class="space-y-1">
      <p class="text-text font-medium text-sm">{{ error ? 'Erreur de chargement' : 'Aucune conversation' }}</p>
      <p class="text-textMuted text-xs max-w-[200px] leading-relaxed">
        {{ error ? error : 'Les clients verront une bulle de chat dans l\'application mobile.' }}
      </p>
    </div>
    <button
      v-if="error || retry"
      @click="$emit('retry')"
      class="inline-flex items-center px-3.5 py-2 bg-primary text-white text-xs font-medium rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
    >
      <Icon name="ph:arrow-clockwise" class="w-3.5 h-3.5 mr-1.5" />
      Réessayer
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error?: string | null
  retry?: boolean
}>()

defineEmits(['retry'])
</script>
