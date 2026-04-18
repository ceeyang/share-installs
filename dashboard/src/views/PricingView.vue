<!-- dashboard/src/views/PricingView.vue -->
<template>
  <AppLayout>
    <div class="p-8 max-w-5xl">
      <div class="mb-8">
        <h1 class="text-xl font-bold text-brand-text mb-1">Pricing</h1>
        <p class="text-sm text-muted">Choose the plan that fits your scale.</p>
      </div>

      <!-- Current usage bar -->
      <div v-if="auth.quota" class="mb-8 bg-surface border border-border rounded-xl p-5">
        <div class="flex items-center justify-between mb-2">
          <div>
            <p class="text-sm font-medium text-brand-text">Current Usage</p>
            <p class="text-xs text-muted mt-0.5">
              Plan: <span class="font-semibold" :class="planColor">{{ auth.planName }}</span>
            </p>
          </div>
          <p class="text-sm font-mono text-muted">
            {{ auth.quota.used.toLocaleString() }} /
            {{ auth.quota.limit < 0 ? '∞' : auth.quota.limit.toLocaleString() }}
            <span class="text-xs ml-1">resolutions</span>
          </p>
        </div>
        <div class="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="auth.usagePercent >= 80 ? 'bg-red-500' : 'bg-brand-cta'"
            :style="{ width: `${auth.usagePercent}%` }"
          />
        </div>
        <p class="text-xs text-muted mt-1.5">{{ auth.usagePercent }}% used this month</p>
      </div>

      <!-- Plan cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="bg-surface border rounded-xl p-6 flex flex-col relative transition-colors"
          :class="[
            auth.planName === plan.id ? 'border-brand-cta' : plan.popular ? 'border-brand-cta/40' : 'border-border',
            plan.popular ? 'bg-gradient-to-b from-surface to-brand-cta/[0.03]' : ''
          ]"
        >
          <!-- Popular badge -->
          <div
            v-if="plan.popular"
            class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-cta text-[#020617] text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap"
          >
            Most Popular
          </div>

          <!-- Current badge -->
          <div class="flex items-center justify-between mb-1">
            <p class="text-xs font-bold uppercase tracking-wider" :class="plan.color">
              {{ plan.name }}
            </p>
            <span
              v-if="auth.planName === plan.id"
              class="text-[10px] font-bold bg-brand-cta/10 text-brand-cta px-2 py-0.5 rounded-full uppercase tracking-wider"
            >
              Current
            </span>
          </div>

          <!-- Price -->
          <div class="mb-1">
            <span class="text-3xl font-bold font-mono text-brand-text">{{ plan.price }}</span>
            <span class="text-sm text-muted"> / month</span>
          </div>

          <!-- Description -->
          <p class="text-xs text-muted mb-5 leading-relaxed">{{ plan.description }}</p>

          <!-- Feature list -->
          <ul class="space-y-2 mb-6 flex-1">
            <li
              v-for="feat in plan.features"
              :key="feat.label"
              class="flex items-start gap-2 text-sm"
              :class="feat.dim ? 'text-muted/50' : 'text-muted'"
            >
              <svg v-if="!feat.dim" class="w-4 h-4 text-brand-cta flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-4 h-4 text-muted/40 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {{ feat.label }}
            </li>
          </ul>

          <!-- CTA -->
          <button
            :disabled="auth.planName === plan.id"
            class="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default"
            :class="auth.planName === plan.id
              ? 'bg-surface-2 text-muted'
              : plan.popular
                ? 'bg-brand-cta text-[#020617] hover:bg-green-600'
                : 'border border-border text-brand-text hover:border-brand-cta/50'"
          >
            {{ auth.planName === plan.id ? 'Current Plan' : plan.cta }}
          </button>
        </div>
      </div>

      <p class="mt-6 text-xs text-muted text-center">
        Need more than Unlimited?
        <a href="https://github.com/ceeyang/share-installs/issues" target="_blank" rel="noopener" class="text-brand-cta hover:underline">Contact us</a>
        for a custom plan. Or go
        <a href="https://github.com/ceeyang/share-installs" target="_blank" rel="noopener" class="text-brand-cta hover:underline">self-hosted</a>
        — unlimited usage, zero cost.
      </p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const auth = useAuthStore()

const planColor = computed(() => {
  if (auth.planName === 'PRO') return 'text-purple-500'
  if (auth.planName === 'UNLIMITED') return 'text-amber-500'
  return 'text-brand-cta'
})

const plans = [
  {
    id: 'FREE' as const,
    name: 'Free',
    price: '$0',
    description: 'Perfect for indie developers and side projects. No credit card required.',
    color: 'text-brand-cta',
    popular: false,
    cta: 'Get Started',
    features: [
      { label: '10 resolutions / minute', dim: false },
      { label: '1 project', dim: false },
      { label: 'GitHub OAuth login', dim: false },
      { label: 'Basic dashboard', dim: false },
      { label: 'All platform SDKs', dim: false },
      { label: 'No priority support', dim: true },
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    price: '$9',
    description: 'For growing product teams that need higher throughput and priority support.',
    color: 'text-purple-500',
    popular: true,
    cta: 'Upgrade to Pro',
    features: [
      { label: '60 resolutions / minute', dim: false },
      { label: 'Up to 5 projects', dim: false },
      { label: 'Advanced analytics & funnel', dim: false },
      { label: 'Multiple API keys per project', dim: false },
      { label: 'Priority email support', dim: false },
      { label: 'Everything in Free', dim: false },
    ],
  },
  {
    id: 'UNLIMITED' as const,
    name: 'Unlimited',
    price: '$29',
    description: 'For high-traffic apps and enterprise teams that need unlimited scale.',
    color: 'text-amber-500',
    popular: false,
    cta: 'Upgrade Now',
    features: [
      { label: '600 resolutions / minute', dim: false },
      { label: 'Unlimited projects', dim: false },
      { label: 'Dedicated support & SLA', dim: false },
      { label: 'Custom quota configuration', dim: false },
      { label: 'Everything in Pro', dim: false },
      { label: 'Invoicing & team billing', dim: false },
    ],
  },
]
</script>
