<!--
==========================================================
Fichier :
SupportSidebar.vue

Description :
Barre latérale responsive du support (Drawer sur mobile, Sidebar 320px sur tablette/desktop).

Projet :
Zemy
==========================================================
-->
<template>
  <div>
    <!-- Desktop / Tablet version -->
    <aside class="hidden md:flex md:w-80 flex-shrink-0 border-r border-border flex-col bg-card h-full">
      <SupportHeader 
        :model-value="searchQuery" 
        @update:model-value="updateSearch" 
        :unread-total="unreadTotal" 
      />
      
      <div class="flex-1 flex flex-col overflow-hidden bg-card">
        <SupportLoading v-if="loading" />
        <SupportEmptyState 
          v-else-if="filteredConversations.length === 0" 
          :error="error" 
          @retry="$emit('retry')" 
        />
        <SupportConversationList
          v-else
          :conversations="filteredConversations"
          :selected-conv="selectedConv"
          @select="$emit('select', $event)"
        />
      </div>

      <!-- Refresh Button -->
      <div class="p-3 border-t border-border bg-card">
        <button
          @click="$emit('retry')"
          :disabled="isRefreshing"
          class="w-full flex items-center justify-center gap-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-50 py-2.5 rounded-xl transition-colors font-medium border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <Icon 
            :name="isRefreshing ? 'ph:spinner-gap' : 'ph:arrows-clockwise'" 
            class="w-4 h-4" 
            :class="{ 'animate-spin': isRefreshing }" 
          />
          Actualiser
        </button>
      </div>
    </aside>

    <!-- Mobile Drawer version -->
    <div v-if="mobileOpen" class="md:hidden fixed inset-0 z-40 flex">
      <!-- Backdrop -->
      <div @click="$emit('close-drawer')" class="fixed inset-0 bg-black/50 backdrop-blur-xs"></div>
      
      <!-- Drawer Content -->
      <aside class="relative w-80 max-w-[85vw] bg-card h-full flex flex-col shadow-xl z-50 animate-slide-in">
        <SupportHeader 
          :model-value="searchQuery" 
          @update:model-value="updateSearch" 
          :unread-total="unreadTotal" 
        />
        
        <div class="flex-1 flex flex-col overflow-hidden bg-card">
          <SupportLoading v-if="loading" />
          <SupportEmptyState 
            v-else-if="filteredConversations.length === 0" 
            :error="error" 
            @retry="$emit('retry')" 
          />
          <SupportConversationList
            v-else
            :conversations="filteredConversations"
            :selected-conv="selectedConv"
            @select="onSelectMobile"
          />
        </div>

        <!-- Refresh Button -->
        <div class="p-3 border-t border-border bg-card">
          <button
            @click="$emit('retry')"
            :disabled="isRefreshing"
            class="w-full flex items-center justify-center gap-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-50 py-2.5 rounded-xl transition-colors font-medium border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <Icon 
              :name="isRefreshing ? 'ph:spinner-gap' : 'ph:arrows-clockwise'" 
              class="w-4 h-4" 
              :class="{ 'animate-spin': isRefreshing }" 
            />
            Actualiser
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Conversation } from '../../types/support'
import SupportHeader from './SupportHeader.vue'
import SupportLoading from './SupportLoading.vue'
import SupportEmptyState from './SupportEmptyState.vue'
import SupportConversationList from './SupportConversationList.vue'

const props = defineProps<{
  searchQuery: string
  unreadTotal: number
  loading: boolean
  isRefreshing: boolean
  error: string | null
  filteredConversations: Conversation[]
  selectedConv: Conversation | null
  mobileOpen: boolean
}>()

const emit = defineEmits(['update:searchQuery', 'select', 'retry', 'close-drawer'])

function updateSearch(val: string) {
  emit('update:searchQuery', val)
}

function onSelectMobile(conv: Conversation) {
  emit('select', conv)
  emit('close-drawer')
}
</script>

<style scoped>
@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.2s ease-out forwards;
}
</style>
