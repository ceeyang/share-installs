<!-- dashboard/src/components/sidebar/SidebarNavItem.vue -->
<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
    :class="isActive
      ? 'bg-surface-2 text-brand-text'
      : 'text-muted hover:bg-surface-2 hover:text-brand-text'"
  >
    <slot name="icon" />
    {{ label }}
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{ to: string; label: string }>()
const route = useRoute()
const isActive = computed(() => route.path.startsWith(props.to))
</script>
