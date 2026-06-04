<template>
  <!-- Backdrop -->
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="$emit('close')"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>
      <div
        class="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden"
        :class="[typeConfig.border]"
      >
        <!-- Colored top bar -->
        <div class="h-1.5 w-full" :class="typeConfig.bar"></div>

        <div class="p-6">
          <div class="flex items-start space-x-4">
            <div
              class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              :class="typeConfig.iconBg"
            >
              <Icon :name="typeConfig.icon" class="w-6 h-6" :class="typeConfig.iconColor" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-text">{{ title }}</h3>
              <p class="mt-1 text-sm text-textLight">{{ message }}</p>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <button
              v-if="showCancel"
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-textLight border border-border rounded-lg hover:bg-background transition-colors"
            >
              {{ cancelText }}
            </button>
            <button
              @click="$emit('confirm')"
              class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              :class="typeConfig.btn"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  type?: 'success' | 'error' | 'warning' | 'info' | 'danger'
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const typeConfig = computed(() => {
  const map: Record<string, any> = {
    success: {
      bar: 'bg-success',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      icon: 'ph:check-circle-fill',
      btn: 'bg-success hover:bg-green-600',
      border: '',
    },
    error: {
      bar: 'bg-error',
      iconBg: 'bg-error/10',
      iconColor: 'text-error',
      icon: 'ph:x-circle-fill',
      btn: 'bg-error hover:bg-red-600',
      border: '',
    },
    danger: {
      bar: 'bg-error',
      iconBg: 'bg-error/10',
      iconColor: 'text-error',
      icon: 'ph:warning-octagon-fill',
      btn: 'bg-error hover:bg-red-600',
      border: '',
    },
    warning: {
      bar: 'bg-warning',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      icon: 'ph:warning-fill',
      btn: 'bg-warning hover:bg-amber-600',
      border: '',
    },
    info: {
      bar: 'bg-primary',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      icon: 'ph:info-fill',
      btn: 'bg-primary hover:bg-primary-dark',
      border: '',
    },
  }
  return map[props.type || 'info']
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(-10px);
}
</style>
