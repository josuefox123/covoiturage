<template>
  <Transition name="toast">
    <div
      v-if="show"
      class="fixed top-5 right-5 z-[100] flex items-center space-x-3 px-4 py-3.5 rounded-xl shadow-lg border max-w-sm w-full"
      :class="typeConfig.bg"
    >
      <Icon :name="typeConfig.icon" class="w-5 h-5 flex-shrink-0" :class="typeConfig.iconColor" />
      <div class="flex-1">
        <p class="text-sm font-semibold" :class="typeConfig.textColor">{{ title }}</p>
        <p v-if="message" class="text-xs mt-0.5 opacity-80" :class="typeConfig.textColor">{{ message }}</p>
      </div>
      <button @click="$emit('close')" class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <Icon name="ph:x" class="w-4 h-4" :class="typeConfig.textColor" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

const props = defineProps<{
  show: boolean
  type?: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const typeConfig = computed(() => {
  const map: Record<string, any> = {
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: 'ph:check-circle-fill',
      iconColor: 'text-success',
      textColor: 'text-green-800',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: 'ph:x-circle-fill',
      iconColor: 'text-error',
      textColor: 'text-red-800',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      icon: 'ph:warning-fill',
      iconColor: 'text-warning',
      textColor: 'text-amber-800',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'ph:info-fill',
      iconColor: 'text-primary',
      textColor: 'text-blue-800',
    },
  }
  return map[props.type || 'info']
})

watch(() => props.show, (val) => {
  if (val && (props.duration || 3500)) {
    setTimeout(() => emit('close'), props.duration || 3500)
  }
})
</script>

<style scoped>
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
