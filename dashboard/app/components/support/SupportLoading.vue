<!--
==========================================================
Fichier :
SupportLoading.vue

Description :
Skeleton loader de chargement des conversations de support.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex-1 divide-y divide-border overflow-hidden">
    <div
      v-for="i in 5"
      :key="i"
      class="px-4 py-4 flex items-start gap-3 animate-pulse"
    >
      <!-- Avatar Skeleton -->
      <div class="w-10 h-10 rounded-full bg-border flex-shrink-0"></div>
      
      <!-- Info Skeleton -->
      <div class="flex-1 min-w-0 space-y-2 mt-0.5">
        <div class="flex items-center justify-between">
          <div class="h-4 bg-border rounded w-1/3"></div>
          <div class="h-3 bg-border rounded w-10"></div>
        </div>
        <div class="h-3 bg-border rounded w-2/3"></div>
      </div>
    </div>
  </div>
</template>
