<!--
==========================================================
Fichier :
index.vue

Description :
Page du Centre de Support Zemy refactorisée.
Déléguée aux composants enfants et au composable useSupport.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex h-[calc(100vh-4rem)] overflow-hidden relative">
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <!-- Sidebar (Desktop permanent / Mobile drawer) -->
    <SupportSidebar
      v-model:searchQuery="searchQuery"
      :unread-total="unreadTotal"
      :loading="loading"
      :is-refreshing="isRefreshing"
      :error="error"
      :filtered-conversations="filteredConversations"
      :selected-conv="selectedConv"
      :mobile-open="mobileDrawerOpen"
      @select="onSelectConversation"
      @retry="loadConversations"
      @close-drawer="mobileDrawerOpen = false"
    />

    <!-- Mobile Conversations List (Visible only on mobile screen sizes when no conversation is selected) -->
    <div v-if="!selectedConv" class="md:hidden flex-1 flex flex-col bg-card h-full">
      <SupportHeader 
        v-model="searchQuery" 
        :unread-total="unreadTotal" 
      />
      <div class="flex-1 flex flex-col overflow-hidden bg-card">
        <SupportLoading v-if="loading" />
        <SupportEmptyState 
          v-else-if="filteredConversations.length === 0" 
          :error="error" 
          @retry="loadConversations" 
        />
        <SupportConversationList
          v-else
          :conversations="filteredConversations"
          :selected-conv="selectedConv"
          @select="onSelectConversation"
        />
      </div>
    </div>

    <!-- Chat Area (Desktop permanent / Mobile full screen when selectedConv is active) -->
    <div 
      class="flex-1 flex flex-col overflow-hidden bg-background h-full"
      :class="{ 'hidden md:flex': !selectedConv }"
    >
      <!-- Mobile header (only visible on mobile if selectedConv is active) -->
      <div v-if="selectedConv" class="md:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button 
          @click="selectedConv = null" 
          class="inline-flex items-center gap-1.5 text-primary font-medium text-sm focus:outline-none"
        >
          <Icon name="ph:arrow-left" class="w-4 h-4" />
          Retour
        </button>
        <span class="font-semibold text-sm text-text truncate max-w-[50%]">
          {{ selectedConv.participant_1_details?.full_name || selectedConv.participant_1_details?.phone || 'Client' }}
        </span>
        <button 
          @click="mobileDrawerOpen = true" 
          class="text-textMuted hover:text-text focus:outline-none flex items-center justify-center p-1"
          aria-label="Ouvrir la liste des conversations"
        >
          <Icon name="ph:chats" class="w-5 h-5" />
        </button>
      </div>

      <!-- Main chat container with transition -->
      <transition name="fade" mode="out-in">
        <div :key="selectedConv?.id || 'empty'" class="flex-1 flex flex-col overflow-hidden">
          <div v-if="!selectedConv" class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-12 bg-background">
            <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shadow-inner">
              <Icon name="ph:chats-circle" class="w-10 h-10 text-primary" />
            </div>
            <h3 class="text-xl font-bold text-text">Centre de Support</h3>
            <p class="text-textMuted max-w-xs text-sm leading-relaxed">
              Sélectionnez une conversation pour lire et répondre aux messages clients.
              Les clients peuvent vous envoyer des images, fichiers, audios et leur position.
            </p>
          </div>
          <SupportChatBox
            v-else
            :conversation="selectedConv"
            :admin-id="adminId"
            class="flex-1 overflow-hidden"
            @message-sent="onMessageSent"
          />
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { useSupport } from '../../composables/useSupport'
import type { Conversation } from '../../types/support'
import SupportHeader from '../../components/support/SupportHeader.vue'
import SupportSidebar from '../../components/support/SupportSidebar.vue'
import SupportLoading from '../../components/support/SupportLoading.vue'
import SupportEmptyState from '../../components/support/SupportEmptyState.vue'
import SupportConversationList from '../../components/support/SupportConversationList.vue'

definePageMeta({
  layout: 'default',
})

useHead({ title: 'Support Client — Zemy' })

// --- State and Composables ---
const {
  searchQuery,
  unreadTotal,
  loading,
  isRefreshing,
  error,
  filteredConversations,
  selectedConv,
  adminId,
  loadConversations
} = useSupport()

const mobileDrawerOpen = ref(false)

// --- Toast ---
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

// --- Handlers ---
function onSelectConversation(conv: Conversation) {
  selectedConv.value = conv
  
  // Transition behavior: Scroll to top of chat box messages container if existing
  nextTick(() => {
    const chatContainer = document.querySelector('.chat-messages-container')
    if (chatContainer) {
      chatContainer.scrollTop = 0
    }
  })
}

function onMessageSent() {
  loadConversations()
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
