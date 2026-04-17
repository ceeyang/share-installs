<!-- dashboard/src/components/stats/StatsGrid.vue -->
<template>
  <div>
    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="!stats"
      title="Could not load stats"
      description="Check your connection and try again."
      action-label="Retry"
      @action="$emit('retry')"
    />

    <div v-else class="space-y-4">
      <!-- KPI row -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-surface border border-border rounded-lg p-5">
          <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Total Clicks</p>
          <p class="text-3xl font-bold font-mono text-brand-text">{{ stats.totalClicks.toLocaleString() }}</p>
        </div>
        <div class="bg-surface border border-border rounded-lg p-5">
          <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Installs Matched</p>
          <p class="text-3xl font-bold font-mono text-brand-text">{{ stats.totalInstalls.toLocaleString() }}</p>
        </div>
        <div class="bg-surface border border-border rounded-lg p-5">
          <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Conversion Rate</p>
          <p class="text-3xl font-bold font-mono text-brand-text">{{ conversionRate }}%</p>
        </div>
      </div>

      <!-- Channels + Platform -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-surface border border-border rounded-lg p-5">
          <h3 class="text-sm font-semibold text-brand-text mb-4">Match Channels</h3>
          <div v-if="!hasChannels" class="text-sm text-muted">No conversions yet</div>
          <div v-else class="space-y-3">
            <div v-for="(count, channel) in stats.byChannel" :key="channel">
              <div class="flex items-center justify-between text-sm mb-1">
                <span class="text-muted capitalize">{{ channel }}</span>
                <span class="font-mono font-semibold text-brand-text">{{ count }}</span>
              </div>
              <div class="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  class="h-full bg-brand-cta rounded-full"
                  :style="{ width: channelBarWidth(count) }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-surface border border-border rounded-lg p-5">
          <h3 class="text-sm font-semibold text-brand-text mb-4">Platform Split</h3>
          <div class="flex gap-3">
            <div class="flex-1 text-center p-4 bg-surface-2 border border-border rounded-lg">
              <p class="text-2xl font-bold font-mono text-brand-text">{{ stats.byPlatform.ios }}</p>
              <p class="text-xs text-muted mt-1 font-medium">iOS</p>
            </div>
            <div class="flex-1 text-center p-4 bg-surface-2 border border-border rounded-lg">
              <p class="text-2xl font-bold font-mono text-brand-text">{{ stats.byPlatform.android }}</p>
              <p class="text-xs text-muted mt-1 font-medium">Android</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AppStats } from '@/api/types'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const props = defineProps<{ stats: AppStats | null; loading: boolean }>()
defineEmits<{ retry: [] }>()

const conversionRate = computed(() => {
  if (!props.stats || props.stats.totalClicks === 0) return '0.0'
  return ((props.stats.totalInstalls / props.stats.totalClicks) * 100).toFixed(1)
})

const hasChannels = computed(() =>
  props.stats ? Object.keys(props.stats.byChannel).length > 0 : false,
)

function channelBarWidth(count: number): string {
  if (!props.stats || props.stats.totalInstalls === 0) return '0%'
  return `${Math.round((count / props.stats.totalInstalls) * 100)}%`
}
</script>
