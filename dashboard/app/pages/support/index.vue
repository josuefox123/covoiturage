<!--
==========================================================
Fichier :
index.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex h-[calc(100vh-4rem)]">
    <!-- Conversations list -->
    <div class="w-80 flex-shrink-0 border-r border-border flex flex-col bg-card">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-border">
        <div class="flex items-center gap-2 mb-3">
          <Icon name="ph:headset-fill" class="w-5 h-5 text-primary" />
          <h2 class="text-lg font-bold text-text">Support Client</h2>
          <span
            v-if="unreadTotal > 0"
            class="ml-auto text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold"
          >
            {{ unreadTotal }}
          </span>
        </div>
        <!-- Search -->
        <div class="relative">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Rechercher un client…"
            class="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <Icon name="ph:spinner" class="animate-spin w-8 h-8 text-primary" />
      </div>

      <!-- Empty -->
      <div v-else-if="filteredConversations.length === 0" class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <Icon name="ph:chat-slash" class="w-14 h-14 text-textMuted/40" />
        <p class="text-textMuted text-sm">Aucune conversation de support</p>
        <p class="text-textMuted text-xs">Les clients verront une bulle de chat dans l'application mobile.</p>
      </div>

      <!-- Conversation items -->
      <div v-else class="flex-1 overflow-y-auto divide-y divide-border">
        <button
          v-for="conv in filteredConversations"
          :key="conv.id"
          @click="selectedConv = conv"
          class="w-full text-left px-4 py-3.5 hover:bg-primary/5 transition-colors flex items-start gap-3"
          :class="[
            selectedConv?.id === conv.id ? 'bg-primary/10 border-l-2 border-l-primary' : '',
            conv.has_urgent_unread ? 'bg-red-50 animate-pulse border-l-4 border-l-red-500' : ''
          ]"
        >
          <!-- Avatar -->
          <div class="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Icon name="ph:user-fill" class="w-5 h-5 text-primary" />
          </div>
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-0.5">
              <span class="font-semibold text-sm text-text truncate">
                {{ conv.participant_1_details?.full_name || conv.participant_1_details?.phone || 'Client' }}
              </span>
              <span class="text-[10px] text-textMuted flex-shrink-0 ml-1">
                {{ formatDate(conv.updated_at) }}
              </span>
            </div>
            <p class="text-xs text-textMuted truncate">
              {{ getLastMsgPreview(conv) }}
            </p>
          </div>
          <!-- Unread badge -->
          <div class="flex flex-col items-end gap-1">
            <span
              v-if="conv.has_urgent_unread"
              class="text-[10px] bg-red-600 text-white rounded-full px-2 py-0.5 font-bold uppercase shadow-sm"
            >
              URGENT
            </span>
            <span
              v-if="conv.unread_count > 0"
              class="text-[10px] bg-primary text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0 mt-0.5 font-bold"
            >
              {{ conv.unread_count }}
            </span>
          </div>
        </button>
      </div>

      <!-- Refresh -->
      <div class="p-3 border-t border-border">
        <button
          @click="loadConversations"
          class="w-full flex items-center justify-center gap-2 text-sm text-primary hover:bg-primary/10 py-2 rounded-lg transition-colors"
        >
          <Icon name="ph:arrows-clockwise" class="w-4 h-4" />
          Actualiser
        </button>
      </div>
    </div>

    <!-- Chat area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div v-if="!selectedConv" class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

definePageMeta({
  layout: 'default',
})

useHead({ title: 'Support Client — Zemy' })

const { fetchApi } = useApi()
const authCookie = useCookie('admin_token')

const conversations = ref<any[]>([])
const selectedConv = ref<any | null>(null)
const loading = ref(true)
const searchQuery = ref('')
const adminId = ref<string | null>(null)
let globalPoll: ReturnType<typeof setInterval> | null = null

// Decode JWT to extract admin user ID (no library needed — just base64 decode)
const decodeJwt = (token: string) => {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded
  } catch { return null }
}

const filteredConversations = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return conversations.value
  return conversations.value.filter((c) => {
    const name = (c.participant_1_details?.full_name || '').toLowerCase()
    const phone = (c.participant_1_details?.phone || '').toLowerCase()
    return name.includes(q) || phone.includes(q)
  })
})

const unreadTotal = computed(() =>
  conversations.value.reduce((acc, c) => acc + (c.unread_count || 0), 0)
)

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diffHours = (now.getTime() - d.getTime()) / 3600000
  if (diffHours < 24) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const getLastMsgPreview = (conv: any) => {
  if (!conv.last_message) return 'Pas encore de message'
  const msg = conv.last_message
  if (msg.message_type === 'image') return '📷 Image'
  if (msg.message_type === 'audio') return '🎤 Audio'
  if (msg.message_type === 'file') return '📎 Fichier'
  if (msg.message_type === 'location') return '📍 Position'
  return msg.content || '…'
}

const playAlarm = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch (e) {
  }
}

let lastUrgentCount = 0

// Silent merge: update existing conversations in-place, add new ones
// This prevents any visible flash/flicker on the UI
const mergeConversations = (freshData: any[]) => {
  // Sort by updated_at desc (latest message first)
  const sorted = [...freshData].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  if (conversations.value.length === 0) {
    conversations.value = sorted
    return
  }

  // Update existing items in-place, append new ones
  const existingMap = new Map(conversations.value.map((c) => [c.id, c]))
  const result: any[] = []
  for (const conv of sorted) {
    const existing = existingMap.get(conv.id)
    if (existing) {
      // Mutate in-place to avoid Vue re-render of unchanged rows
      Object.assign(existing, conv)
      result.push(existing)
    } else {
      result.push(conv)
    }
  }
  conversations.value = result

  // Keep selectedConv in sync without replacing the ref
  if (selectedConv.value) {
    const updated = conversations.value.find(c => c.id === selectedConv.value.id)
    if (updated) Object.assign(selectedConv.value, updated)
  }
}

const loadConversations = async () => {
  try {
    const data = await fetchApi('/conversations/?type=support')
    const freshData: any[] = Array.isArray(data) ? data : (data.results || [])

    // Check for new urgent messages BEFORE merging
    const currentUrgentCount = freshData.filter(c => c.has_urgent_unread).length
    if (currentUrgentCount > lastUrgentCount) {
      playAlarm()
    }
    lastUrgentCount = currentUrgentCount

    mergeConversations(freshData)
  } catch (e) {
    console.error('Failed to load support conversations:', e)
  } finally {
    loading.value = false
  }
}

const onMessageSent = () => {
  loadConversations()
}

onMounted(async () => {
  // Extract admin ID from JWT
  if (authCookie.value) {
    const decoded = decodeJwt(authCookie.value)
    // Django SimpleJWT puts user_id in the token
    if (decoded?.user_id) adminId.value = decoded.user_id
  }

  await loadConversations()
  // Auto-refresh every 8s
  globalPoll = setInterval(loadConversations, 8000)
})

onUnmounted(() => {
  if (globalPoll) clearInterval(globalPoll)
})
</script>
