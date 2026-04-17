<!-- dashboard/src/views/RegisterView.vue -->
<template>
  <AuthLayout>
    <div class="text-center mb-8">
      <div class="inline-flex items-center gap-2 mb-3">
        <div class="w-9 h-9 bg-brand-cta/10 border border-brand-cta/20 rounded-xl flex items-center justify-center">
          <svg class="w-5 h-5 text-brand-cta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <span class="font-mono font-bold text-lg text-brand-text">share-installs</span>
      </div>
      <h1 class="text-xl font-bold text-brand-text">Create your account</h1>
    </div>

    <div class="bg-surface border border-border rounded-xl p-6">
      <div v-if="errorMsg" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p class="text-sm text-red-500 leading-snug">{{ errorMsg }}</p>
      </div>

      <form @submit.prevent="submit" class="space-y-3">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          required
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password (min 8 characters)"
          autocomplete="new-password"
          required
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <input
          v-model="displayName"
          type="text"
          placeholder="Display name (optional)"
          autocomplete="nickname"
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 px-4 rounded-lg bg-brand-cta text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
    </div>

    <p class="mt-5 text-center text-xs text-muted">
      Already have an account?
      <RouterLink to="/login" class="text-brand-cta hover:underline">Sign in →</RouterLink>
    </p>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { register } from '@/api/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function submit() {
  loading.value = true
  errorMsg.value = ''
  try {
    await register(email.value, password.value, displayName.value || undefined)
    auth.initialized = false
    await auth.init()
    router.push('/apps')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    errorMsg.value = msg ?? 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>
