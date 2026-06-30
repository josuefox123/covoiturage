<!--
==========================================================
Fichier :
SupportHeader.vue

Description :
En-tête de la barre latérale du support avec compteur non lus et champ de recherche.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="px-5 py-4 border-b border-border bg-card">
    <div class="flex items-center gap-2 mb-3">
      <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon name="ph:headset-fill" class="w-4.5 h-4.5 text-primary" />
      </div>
      <h2 class="text-base font-bold text-text">Support Client</h2>
      <span
        v-if="unreadTotal > 0"
        class="ml-auto text-[11px] bg-red-500 text-white rounded-full px-2 py-0.5 font-bold shadow-sm"
        aria-label="Total des messages non lus"
      >
        {{ unreadTotal }}
      </span>
    </div>
    <!-- Search -->
    <div class="relative">
      <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
      <input
        :value="modelValue"
        @input="onInput"
        type="text"
        placeholder="Rechercher un client…"
        class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        aria-label="Rechercher un client par son nom ou son téléphone"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  unreadTotal: number
}>()

const emit = defineEmits(['update:modelValue'])

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
}
</script>
