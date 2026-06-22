<!--
==========================================================
Fichier :
SupportChatBox.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="flex flex-col h-full bg-background border-l border-border">
    <!-- Chat Header -->
    <div class="flex items-center gap-3 px-6 py-4 bg-card border-b border-border">
      <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <Icon name="ph:user-circle-fill" class="w-6 h-6 text-primary" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-text truncate">
          {{ conversation?.participant_1_details?.full_name || conversation?.participant_1_details?.phone || 'Client' }}
        </p>
        <p class="text-xs text-textMuted">
          {{ conversation?.participant_1_details?.phone }}
        </p>
      </div>
      <span
        class="text-xs px-2 py-0.5 rounded-full font-medium"
        :class="(conversation?.unread_count ?? 0) > 0 ? 'bg-primary/15 text-primary' : 'bg-green-500/15 text-green-600'"
      >
        {{ (conversation?.unread_count ?? 0) > 0 ? `${conversation.unread_count} non lu(s)` : 'À jour' }}
      </span>
    </div>

    <!-- Messages -->
    <!-- Messages list: newest at top, oldest at bottom -->
    <div ref="messagesEl" class="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-1">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <Icon name="ph:spinner" class="animate-spin w-8 h-8 text-primary" />
      </div>

      <div v-else-if="messages.length === 0" class="flex flex-col items-center justify-center h-full gap-3 text-center">
        <Icon name="ph:chat-dots" class="w-16 h-16 text-textMuted/40" />
        <p class="text-textMuted font-medium">Aucun message pour l'instant</p>
      </div>

      <template v-else>
        <div
          v-for="(msg, index) in messages"
          :key="msg.id"
        >
          <!-- Date separator: show when date changes between consecutive messages (desc order) -->
          <div
            v-if="index === messages.length - 1 || !isSameDay(msg.created_at, messages[index + 1]?.created_at)"
            class="flex items-center gap-3 my-3"
          >
            <div class="flex-1 h-px bg-border" />
            <span class="text-[11px] font-semibold text-textMuted px-2 bg-background rounded-full border border-border py-0.5">
              {{ formatDay(msg.created_at) }}
            </span>
            <div class="flex-1 h-px bg-border" />
          </div>
          <div
            class="flex mt-2"
            :class="isAdminMsg(msg) ? 'justify-end' : 'justify-start'"
          >
            <!-- Client avatar -->
            <div v-if="!isAdminMsg(msg)" class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <Icon name="ph:user" class="w-4 h-4 text-primary" />
            </div>

          <div
            class="max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 shadow-sm"
            :class="isAdminMsg(msg) ? 'bg-primary text-white rounded-br-sm' : 'bg-card border border-border text-text rounded-bl-sm'"
          >
            <!-- Nom de l'expéditeur (si ce n'est pas l'admin) -->
            <p v-if="!isAdminMsg(msg)" class="text-xs font-bold text-primary mb-1">
              {{ msg.sender_details?.full_name || 'Client' }}
            </p>

            <!-- Text -->
            <p v-if="msg.message_type === 'text'" class="text-sm leading-relaxed whitespace-pre-wrap">
              {{ msg.content }}
            </p>

            <!-- Image -->
            <div v-else-if="msg.message_type === 'image' && msg.attachment_url">
              <img
                :src="msg.attachment_url"
                class="rounded-lg max-w-[240px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                @click="openMedia(msg.attachment_url)"
                alt="Image"
              />
            </div>

            <!-- Audio -->
            <div v-else-if="msg.message_type === 'audio' && msg.attachment_url" class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <Icon name="ph:waveform" class="w-5 h-5 flex-shrink-0" :class="isAdminMsg(msg) ? 'text-white/80' : 'text-primary'" />
                <span class="text-xs" :class="isAdminMsg(msg) ? 'text-white/70' : 'text-textMuted'">Message audio</span>
              </div>
              <audio controls class="h-8 max-w-[200px] mt-1">
                <source :src="msg.attachment_url" />
              </audio>
            </div>

            <!-- File -->
            <a
              v-else-if="msg.message_type === 'file' && msg.attachment_url"
              :href="msg.attachment_url"
              target="_blank"
              class="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Icon name="ph:file-arrow-down" class="w-5 h-5" :class="isAdminMsg(msg) ? 'text-white' : 'text-primary'" />
              <span class="text-sm underline">Télécharger le fichier</span>
            </a>

            <!-- Location -->
            <a
              v-else-if="msg.message_type === 'location'"
              :href="`https://maps.google.com/?q=${msg.location_lat},${msg.location_lng}`"
              target="_blank"
              class="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Icon name="ph:map-pin" class="w-5 h-5" :class="isAdminMsg(msg) ? 'text-white' : 'text-primary'" />
              <span class="text-sm underline">{{ msg.content || 'Voir la position' }}</span>
            </a>

            <!-- Timestamp + urgent badge -->
            <div class="flex items-center gap-2 mt-1.5" :class="isAdminMsg(msg) ? 'justify-end' : ''">
              <span
                v-if="msg.is_urgent"
                class="text-[9px] font-bold uppercase bg-red-500 text-white px-1.5 py-0.5 rounded-full"
              >🚨 URGENT</span>
              <p class="text-[10px]" :class="isAdminMsg(msg) ? 'text-white/60' : 'text-textMuted'">
                {{ formatTime(msg.created_at) }}
              </p>
            </div>
          </div>
        </div>
        </div>
      </template>
    </div>

    <!-- Reply input -->
    <div class="px-4 py-3 bg-card border-t border-border">
      <div class="flex items-end gap-3">
        <textarea
          v-model="replyText"
          rows="2"
          placeholder="Répondre au client… (Entrée pour envoyer)"
          class="flex-1 resize-none rounded-xl border border-border bg-background text-text text-sm px-4 py-2.5 placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          @keydown.enter.exact.prevent="sendReply"
        />
        <button
          @click="sendReply"
          :disabled="!replyText.trim() || sending"
          class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
          title="Envoyer"
        >
          <Icon v-if="!sending" name="ph:paper-plane-tilt-fill" class="w-5 h-5" />
          <Icon v-else name="ph:spinner" class="animate-spin w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'

const props = defineProps<{
  conversation: any | null
  adminId: string | null
}>()

const emit = defineEmits(['message-sent'])

const { fetchApi } = useApi()

const messages = ref<any[]>([])
const loading = ref(false)
const replyText = ref('')
const sending = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
let pollInterval: ReturnType<typeof setInterval> | null = null

const isAdminMsg = (msg: any) => {
  // La conversation de support a toujours un client en participant_1
  // Les messages du client vont à gauche, ceux de l'admin à droite
  const clientId = String(
    props.conversation?.participant_1_details?.id ||
    props.conversation?.participant_1 ||
    ''
  )
  const senderIdStr = String(msg.sender_details?.id || msg.sender || '')
  if (!clientId || !senderIdStr) return false
  // isAdminMsg = true => bulle à droite (admin a envoyé)
  // isAdminMsg = false => bulle à gauche (client a envoyé)
  return senderIdStr !== clientId
}

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const formatDay = (dateStr: string) => {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const isSameDay = (a: string, b?: string) => {
  if (!b) return false
  return new Date(a).toDateString() === new Date(b).toDateString()
}

const openMedia = (url: string) => window.open(url, '_blank')

// Scroll to TOP = newest messages (list is reversed: newest at top)
const scrollToTop = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = 0
  }
}

// Check if user is at the top (newest messages)
const isAtTop = () => {
  if (!messagesEl.value) return true
  return messagesEl.value.scrollTop < 80
}

// Silent merge: prepend NEW messages at the start (newest first)
const mergeMessages = (freshData: any[]) => {
  // Sort newest first
  const sorted = [...freshData].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  if (messages.value.length === 0) {
    messages.value = sorted
    return
  }
  const existingIds = new Set(messages.value.map((m) => m.id))
  const newMsgs = sorted.filter((m) => !existingIds.has(m.id))
  if (newMsgs.length > 0) {
    const wasAtTop = isAtTop()
    // Prepend new messages at the start (they are the newest)
    messages.value.unshift(...newMsgs)
    if (wasAtTop) scrollToTop()
  }
}

const loadMessages = async (initial = false) => {
  if (!props.conversation) return
  try {
    const data = await fetchApi(`/messages/?conversation=${props.conversation.id}`)
    const freshData: any[] = Array.isArray(data) ? data : (data.results || [])
    if (initial) {
      // Sort newest first on initial load
      messages.value = [...freshData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      scrollToTop()
    } else {
      mergeMessages(freshData)
    }
  } catch (e) { /* silent */ }
}

const sendReply = async () => {
  if (!replyText.value.trim() || !props.conversation || sending.value) return
  sending.value = true
  const content = replyText.value.trim()
  replyText.value = ''
  try {
    await fetchApi('/messages/', {
      method: 'POST',
      body: {
        conversation: props.conversation.id,
        content,
        message_type: 'text',
      },
    })
    await loadMessages(true) // force refresh after sending
    scrollToTop()
    emit('message-sent')
  } catch (e) {
    console.error('Failed to send reply:', e)
  } finally {
    sending.value = false
  }
}

watch(
  () => props.conversation,
  async (conv) => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
    messages.value = []
    if (!conv) return
    loading.value = true
    await loadMessages(true) // initial = true: sort + scroll to top
    loading.value = false
    // Poll silently every 4s — merging new messages only (no flash)
    pollInterval = setInterval(() => loadMessages(false), 4000)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

