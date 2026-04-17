<!-- dashboard/src/components/common/ToastContainer.vue -->
<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <div class="pointer-events-auto flex flex-col gap-2">
        <TransitionGroup name="toast">
          <ToastItem
            v-for="toast in notifs.toasts"
            :key="toast.id"
            v-bind="toast"
            @dismiss="notifs.dismiss(toast.id)"
          />
        </TransitionGroup>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications'
import ToastItem from './ToastItem.vue'

const notifs = useNotificationsStore()
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}
</style>
