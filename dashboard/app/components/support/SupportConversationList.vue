<!--
==========================================================
Fichier :
SupportConversationList.vue

Description :
Liste défilante des conversations de support.
Gère la navigation au clavier flèches haut/bas et l'accessibilité role="listbox".

Projet :
Zemy
==========================================================
-->
<template>
  <div 
    class="flex-1 overflow-y-auto divide-y divide-border"
    role="listbox"
    aria-label="Liste des conversations de support"
    @keydown="handleKeydown"
  >
    <SupportConversationItem
      v-for="(conv, index) in conversations"
      :key="conv.id"
      :conversation="conv"
      :is-selected="selectedConv?.id === conv.id"
      :tabindex="index === activeIndex ? 0 : -1"
      :ref="el => { if (el) itemRefs[index] = el }"
      @select="selectConversation(conv, index)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUpdate } from 'vue'
import type { Conversation } from '../../types/support'
import SupportConversationItem from './SupportConversationItem.vue'

const props = defineProps<{
  conversations: Conversation[]
  selectedConv: Conversation | null
}>()

const emit = defineEmits(['select'])

const activeIndex = ref(0)
const itemRefs = ref<any[]>([])

onBeforeUpdate(() => {
  itemRefs.value = []
})

function selectConversation(conv: Conversation, index: number) {
  activeIndex.value = index
  emit('select', conv)
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.conversations.length) return
  
  let newIndex = activeIndex.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    newIndex = (activeIndex.value + 1) % props.conversations.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    newIndex = (activeIndex.value - 1 + props.conversations.length) % props.conversations.length
  } else {
    return
  }

  activeIndex.value = newIndex
  
  // Focus item element
  const targetItem = itemRefs.value[newIndex]
  if (targetItem && targetItem.$el) {
    targetItem.$el.focus()
  }
}
</script>
