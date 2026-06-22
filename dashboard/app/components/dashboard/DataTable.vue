<!--
==========================================================
Fichier :
DataTable.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
    <div class="p-6 border-b border-border flex justify-between items-center">
      <h3 class="text-lg font-bold text-text">{{ title }}</h3>
      <button class="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Tout voir</button>
    </div>
    
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm text-text">
        <thead class="bg-background text-textMuted uppercase text-xs font-semibold">
          <tr>
            <th v-for="col in columns" :key="col.key" class="px-6 py-4">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody v-if="loading">
          <tr v-for="i in 5" :key="i" class="border-b border-border last:border-0 animate-pulse">
            <td v-for="col in columns" :key="col.key" class="px-6 py-4">
              <div class="h-4 bg-border rounded" :class="col.key === 'status' ? 'w-16' : 'w-24'"></div>
            </td>
          </tr>
        </tbody>
        <tbody v-else-if="!data.length">
          <tr>
            <td :colspan="columns.length" class="px-6 py-8 text-center text-textMuted">Aucune donnée disponible</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="(row, idx) in data" :key="idx" class="border-b border-border last:border-0 hover:bg-background/50 transition-colors">
            <td v-for="col in columns" :key="col.key" class="px-6 py-4">
              <slot :name="`cell-${col.key}`" :row="row">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: { type: String, required: true },
  columns: { type: Array as () => { key: string, label: string }[], required: true },
  data: { type: Array as () => any[], required: true },
  loading: { type: Boolean, default: false }
})
</script>
