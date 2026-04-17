<!-- dashboard/src/views/PricingView.vue -->
<template>
  <AppLayout>
    <div class="p-8 max-w-4xl">
      <div class="mb-8">
        <h1 class="text-xl font-bold text-brand-text mb-1">Pricing</h1>
        <p class="text-sm text-muted">Choose the plan that fits your scale.</p>
      </div>

      <!-- Current usage bar (only shown when quota is loaded) -->
      <div v-if="auth.quota" class="mb-8 bg-surface border border-border rounded-lg p-5">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium text-brand-text">Monthly Installs</p>
          <p class="text-sm font-mono text-muted">
            {{ auth.quota.used.toLocaleString() }} /
            {{ auth.quota.limit < 0 ? '∞' : auth.quota.limit.toLocaleString() }}
          </p>
        </div>
        <div class="h-2 bg-surface-2 rounded-full overflow-hidden">
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
          class="bg-surface border rounded-xl p-6 flex flex-col transition-colors"
          :class="auth.planName === plan.id ? 'border-brand-cta' : 'border-border'"
        >
          <!-- Plan header -->
          <div class="flex items-center justify-between mb-1">
            <p class="text-sm font-bold uppercase tracking-wider" :class="plan.color">
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
          <div class="mb-5">
            <span class="text-3xl font-bold font-mono text-brand-text">{{ plan.price }}</span>
            <span class="text-sm text-muted">/month</span>
          </div>

          <!-- Feature list -->
          <ul class="space-y-2 mb-6 flex-1">
            <li
              v-for="feat in plan.features"
              :key="feat"
              class="flex items-center gap-2 text-sm text-muted"
            >
              <svg class="w-4 h-4 text-brand-cta flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ feat }}
            </li>
          </ul>

          <!-- CTA -->
          <button
            :disabled="auth.planName === plan.id"
            class="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default"
            :class="auth.planName === plan.id
              ? 'bg-surface-2 text-muted'
              : 'bg-brand-cta text-[#020617] hover:bg-green-600'"
          >
            {{ auth.planName === plan.id ? 'Current Plan' : 'Upgrade →' }}
          </button>
        </div>
      </div>

      <p class="mt-6 text-xs text-muted text-center">
        Need a custom plan?
        <a href="mailto:hello@share-installs.dev" class="text-brand-cta hover:underline">Contact us</a>
      </p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const plans = [
  {
    id: 'FREE' as const,
    name: 'Free',
    price: '$0',
    color: 'text-brand-cta',
    features: [
      '500 Monthly Installs',
      '1 Application',
      '7-Day Data Retention',
      'Community Support',
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    price: '$19',
    color: 'text-purple-500',
    features: [
      '10,000 Monthly Installs',
      '5 Applications',
      '90-Day Data Retention',
      'Priority Support',
    ],
  },
  {
    id: 'UNLIMITED' as const,
    name: 'Unlimited',
    price: '$99',
    color: 'text-amber-500',
    features: [
      'Unlimited Installs',
      'Unlimited Applications',
      '1-Year Data Retention',
      'Dedicated Support',
    ],
  },
]
</script>
