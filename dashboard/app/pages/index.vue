<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex items-center justify-center min-h-screen">
    <p>Redirection vers le site principal...</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: false,
  layout: false
})

// Redirige vers le site Bootstrap statique
if (import.meta.client) {
  window.location.href = '/landing/index.html'
} else {
  await navigateTo('/landing/index.html', { external: true })
}
</script>
