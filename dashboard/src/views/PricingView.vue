<!-- dashboard/src/views/PricingView.vue -->
<template>
  <AppLayout>
    <div class="p-8 max-w-5xl mx-auto">
      <!-- Header -->
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
              <span v-if="auth.quota.planExpiresAt" class="ml-2 text-muted/70">
                · expires {{ formatDate(auth.quota.planExpiresAt) }}
              </span>
            </p>
          </div>
          <p class="text-sm font-mono text-muted">
            {{ auth.quota.monthly.used.toLocaleString() }} /
            {{ auth.quota.monthly.limit === null ? '∞' : auth.quota.monthly.limit.toLocaleString() }}
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

      <!-- Billing cycle toggle -->
      <div class="flex items-center justify-center gap-3 mb-8">
        <span class="text-sm font-medium" :class="!isYearly ? 'text-brand-text' : 'text-muted'">
          Monthly
        </span>
        <button
          id="billing-cycle-toggle"
          class="relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer"
          :class="isYearly ? 'bg-brand-cta' : 'bg-surface-2 border border-border'"
          @click="isYearly = !isYearly"
          :aria-pressed="isYearly"
          aria-label="Toggle yearly billing"
        >
          <span
            class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
            :class="isYearly ? 'translate-x-6' : 'translate-x-0'"
          />
        </button>
        <span class="text-sm font-medium" :class="isYearly ? 'text-brand-text' : 'text-muted'">
          Yearly
          <span class="ml-1.5 text-[10px] font-bold bg-brand-cta/15 text-brand-cta px-1.5 py-0.5 rounded-full uppercase tracking-wider">
            Save ~17%
          </span>
        </span>
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
            <template v-if="plan.id === 'FREE'">
              <span class="text-3xl font-bold font-mono text-brand-text">$0</span>
              <span class="text-sm text-muted"> / forever</span>
            </template>
            <template v-else>
              <span class="text-3xl font-bold font-mono text-brand-text">
                ${{ isYearly ? plan.yearlyPrice : plan.monthlyPrice }}
              </span>
              <span class="text-sm text-muted">
                {{ isYearly ? ' / year' : ' / month' }}
              </span>
              <p v-if="isYearly" class="text-xs text-muted mt-0.5">
                (~${{ (plan.yearlyPrice / 12).toFixed(2) }}/mo billed annually)
              </p>
            </template>
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
            :id="`plan-cta-${plan.id.toLowerCase()}`"
            :disabled="auth.planName === plan.id || loadingPlanId === plan.id"
            class="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default flex items-center justify-center gap-2"
            :class="auth.planName === plan.id
              ? 'bg-surface-2 text-muted'
              : plan.popular
                ? 'bg-brand-cta text-[#020617] hover:bg-green-600'
                : 'border border-border text-brand-text hover:border-brand-cta/50'"
            @click="handlePlanSelect(plan)"
          >
            <svg
              v-if="loadingPlanId === plan.id"
              class="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {{ auth.planName === plan.id ? 'Current Plan' : loadingPlanId === plan.id ? 'Loading…' : plan.cta }}
          </button>
        </div>
      </div>

      <!-- Cancel subscription -->
      <div v-if="auth.planName !== 'FREE' && subscription" class="mt-6 text-center">
        <button
          id="cancel-subscription-btn"
          class="text-xs text-muted hover:text-red-400 transition-colors underline underline-offset-2 cursor-pointer"
          @click="handleCancel"
          :disabled="cancelling"
        >
          {{ cancelling ? 'Cancelling…' : 'Cancel subscription' }}
        </button>
        <p v-if="subscription.scheduledChange?.action === 'cancel'" class="text-xs text-muted/70 mt-1">
          Cancellation scheduled for {{ formatDate(subscription.scheduledChange.effectiveAt) }}
        </p>
      </div>

      <p class="mt-6 text-xs text-muted text-center">
        Need more than Unlimited?
        <a href="https://github.com/ceeyang/share-installs/issues" target="_blank" rel="noopener" class="text-brand-cta hover:underline">Contact us</a>
        for a custom plan. Or go
        <a href="https://github.com/ceeyang/share-installs" target="_blank" rel="noopener" class="text-brand-cta hover:underline">self-hosted</a>
        — unlimited usage, zero cost.
      </p>

      <!-- Error message -->
      <p v-if="errorMsg" class="mt-4 text-xs text-red-400 text-center">{{ errorMsg }}</p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { computed, ref, onMounted } from 'vue'
import { createCheckout, cancelSubscription, getSubscription } from '@/api/billing'
import type { SubscriptionDetails } from '@/api/billing'

// Declare Paddle global (loaded via CDN in index.html)
declare const Paddle: {
  Environment: { set: (env: string) => void }
  Initialize: (opts: { token: string; eventCallback?: (data: unknown) => void }) => void
  Checkout: { open: (opts: { transactionId: string }) => void }
}

const auth = useAuthStore()
const isYearly = ref(false)
const loadingPlanId = ref<string | null>(null)
const cancelling = ref(false)
const errorMsg = ref('')
const subscription = ref<SubscriptionDetails | null>(null)

const planColor = computed(() => {
  if (auth.planName === 'PRO') return 'text-purple-500'
  if (auth.planName === 'UNLIMITED') return 'text-amber-500'
  return 'text-brand-cta'
})

const plans = [
  {
    id: 'FREE' as const,
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Perfect for indie developers and side projects. No credit card required.',
    color: 'text-brand-cta',
    popular: false,
    cta: 'Get Started',
    priceIds: { monthly: null, yearly: null },
    features: [
      { label: '500 monthly resolutions', dim: false },
      { label: '1 project', dim: false },
      { label: '2 API keys per project', dim: false },
      { label: '7-day data retention', dim: false },
      { label: 'Basic dashboard & stats', dim: false },
      { label: 'Priority support', dim: true },
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    monthlyPrice: 4.99,
    yearlyPrice: 50,
    description: 'For growing product teams that need higher throughput and longer data history.',
    color: 'text-purple-500',
    popular: true,
    cta: 'Upgrade to Pro',
    features: [
      { label: '10,000 monthly resolutions', dim: false },
      { label: 'Up to 5 projects', dim: false },
      { label: '10 API keys per project', dim: false },
      { label: '90-day data retention', dim: false },
      { label: 'Advanced analytics & Funnels', dim: false },
      { label: 'Priority email support', dim: false },
    ],
  },
  {
    id: 'UNLIMITED' as const,
    name: 'Unlimited',
    monthlyPrice: 9.99,
    yearlyPrice: 100,
    description: 'For high-traffic apps and enterprise teams that need unlimited scale and data history.',
    color: 'text-amber-500',
    popular: false,
    cta: 'Upgrade Now',
    features: [
      { label: 'Unlimited monthly resolutions', dim: false },
      { label: 'Unlimited projects', dim: false },
      { label: 'Unlimited API keys', dim: false },
      { label: '365-day data retention', dim: false },
      { label: 'Dedicated support & SLA', dim: false },
      { label: 'Custom branding & Invoicing', dim: false },
    ],
  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Initialize Paddle.js in sandbox for non-production environments.
// Replace 'sandbox' with 'production' and set your Paddle client token in PADDLE_CLIENT_TOKEN (root .env).
function initPaddle() {
  try {
    const token = import.meta.env.PADDLE_CLIENT_TOKEN
    if (!token) return
    if (import.meta.env.PADDLE_ENV === 'sandbox') {
      Paddle.Environment.set('sandbox')
    }
    Paddle.Initialize({
      token,
      eventCallback(data) {
        // Refresh quota after successful checkout
        const event = data as { name?: string }
        if (event?.name === 'checkout.completed') {
          auth.refresh()
        }
      },
    })
  } catch {
    // Paddle.js not loaded yet – will be initialized on demand
  }
}

async function handlePlanSelect(plan: typeof plans[number]) {
  if (auth.planName === plan.id) return
  if (plan.id === 'FREE') return // Downgrade via cancel button

  errorMsg.value = ''
  loadingPlanId.value = plan.id

  try {
    // Determine price ID based on billing cycle
    const priceEnvKey = isYearly.value
      ? `PADDLE_PRICE_${plan.id}_YEARLY`
      : `PADDLE_PRICE_${plan.id}_MONTHLY`
    // Price IDs come from environment variables (injected at build time from root .env)
    const priceId = (import.meta.env as Record<string, string>)[priceEnvKey] || ''

    if (!priceId || priceId.startsWith('pri_placeholder')) {
      errorMsg.value = 'Payment is not configured yet. Please contact support.'
      return
    }

    const { transactionId } = await createCheckout(priceId)

    // Open Paddle Overlay
    Paddle.Checkout.open({ transactionId })
  } catch (err) {
    console.error('Checkout failed', err)
    errorMsg.value = 'Failed to open checkout. Please try again.'
  } finally {
    loadingPlanId.value = null
  }
}

async function handleCancel() {
  if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) return
  cancelling.value = true
  errorMsg.value = ''
  try {
    await cancelSubscription()
    await auth.refresh()
    await loadSubscription()
  } catch {
    errorMsg.value = 'Failed to cancel subscription. Please try again.'
  } finally {
    cancelling.value = false
  }
}

async function loadSubscription() {
  if (auth.planName === 'FREE') return
  try {
    const { subscription: sub } = await getSubscription()
    subscription.value = sub
  } catch {
    // Non-critical
  }
}

onMounted(() => {
  initPaddle()
  loadSubscription()
})
</script>
