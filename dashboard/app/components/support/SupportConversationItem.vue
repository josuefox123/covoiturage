<!--
==========================================================
Fichier :
SupportConversationItem.vue

Description :
Élément individuel représentant une conversation de support dans la liste.
Gère le formatage des dates, initiales d'avatar, badges et l'accessibilité.

Projet :
Zemy
==========================================================
-->
<template>
  <button
    ref="itemRef"
    @click="$emit('select', conversation)"
    @keydown.enter.prevent="$emit('select', conversation)"
    @keydown.space.prevent="$emit('select', conversation)"
    class="w-full text-left px-4 py-3.5 hover:bg-primary/5 focus:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all flex items-start gap-3 border-l-2"
    :class="[
      isSelected ? 'bg-primary/10 border-l-primary' : 'border-l-transparent',
      conversation.has_urgent_unread ? 'bg-red-50/50 animate-pulse border-l-red-500' : ''
    ]"
    role="button"
    :tabindex="tabindex"
    :aria-selected="isSelected"
    :aria-label="ariaLabel"
  >
    <!-- Avatar Container -->
    <div class="relative flex-shrink-0">
      <!-- Avatar Photo -->
      <img
        v-if="conversation.participant_1_details?.avatar"
        :src="conversation.participant_1_details.avatar"
        alt=""
        class="w-10 h-10 rounded-full object-cover border border-border"
      />
      <!-- Avatar Initials -->
      <div
        v-else
        class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20"
      >
        <span>{{ initials }}</span>
      </div>
      <!-- Indicator "En ligne" (Active user check) -->
      <span
        v-if="conversation.participant_1_details?.is_active"
        class="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card"
        title="En ligne"
      ></span>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between mb-0.5">
        <span class="font-semibold text-sm text-text truncate">
          {{ clientName }}
        </span>
        <span class="text-[10px] text-textMuted flex-shrink-0 ml-1">
          {{ relativeTime }}
        </span>
      </div>
      <p
        class="text-xs truncate"
        :class="[
          conversation.unread_count && conversation.unread_count > 0 
            ? 'text-text font-bold' 
            : 'text-textMuted font-normal'
        ]"
      >
        {{ lastMessagePreview }}
      </p>
    </div>

    <!-- Badges -->
    <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
      <span
        v-if="conversation.has_urgent_unread"
        class="text-[9px] bg-red-600 text-white rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider shadow-sm animate-bounce"
      >
        URGENT
      </span>
      <span
        v-if="conversation.unread_count && conversation.unread_count > 0"
        class="text-[10px] bg-primary text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold shadow-sm"
      >
        {{ conversation.unread_count }}
      </span>
      <span
        v-else-if="isNew"
        class="text-[9px] bg-success text-white rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider shadow-sm"
      >
        NOUVEAU
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Conversation } from '../../types/support'

const props = withDefaults(defineProps<{
  conversation: Conversation
  isSelected: boolean
  tabindex?: number
}>(), {
  tabindex: 0
})

defineEmits(['select'])

const itemRef = ref<HTMLButtonElement | null>(null)

// Focus handler when selection shifts or keyboard navigation triggers
watch(() => props.isSelected, (val) => {
  if (val && itemRef.value) {
    itemRef.value.focus()
  }
})

// --- Get initials for avatar ---
const initials = computed(() => {
  const details = props.conversation.participant_1_details
  const name = details?.full_name || details?.phone || 'Client'
  return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
})

const clientName = computed(() => {
  const details = props.conversation.participant_1_details
  return details?.full_name || details?.phone || 'Client'
})

// --- Get last message preview ---
const lastMessagePreview = computed(() => {
  const conv = props.conversation
  if (!conv.last_message) return 'Pas encore de message'
  const msg = conv.last_message
  if (msg.message_type === 'image') return '📷 Image'
  if (msg.message_type === 'audio') return '🎤 Audio'
  if (msg.message_type === 'file') return '📎 Fichier'
  if (msg.message_type === 'location') return '📍 Position'
  return msg.content || '…'
})

// --- Format Relative Time ---
const relativeTime = computed(() => {
  const dateStr = props.conversation.updated_at
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `il y a ${diffMins} min`

  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return "Aujourd'hui"
  }

  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isYesterday) {
    return 'Hier'
  }

  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
})

// --- Check if conversation is "New" (modified in the last 2 hours) ---
const isNew = computed(() => {
  const dateStr = props.conversation.created_at
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const diffHours = (now.getTime() - d.getTime()) / 3600000
  return diffHours <= 2
})

// --- Accessible ARIA Label ---
const ariaLabel = computed(() => {
  const name = clientName.value
  const unread = props.conversation.unread_count || 0
  const unreadText = unread > 0 ? `, ${unread} message(s) non lu(s)` : ''
  const urgentText = props.conversation.has_urgent_unread ? ', Urgent' : ''
  return `Conversation avec ${name}${unreadText}${urgentText}`
})
</script>
