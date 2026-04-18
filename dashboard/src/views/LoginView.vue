<!-- dashboard/src/views/LoginView.vue -->
<template>
  <AuthLayout>
    <!-- Logo -->
    <div class="text-center mb-6">
      <div class="inline-flex items-center gap-2 mb-1">
        <div class="w-8 h-8 bg-brand-cta/10 border border-brand-cta/20 rounded-xl flex items-center justify-center">
          <svg class="w-4 h-4 text-brand-cta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <span class="font-mono font-bold text-base text-brand-text">share-installs</span>
      </div>
    </div>

    <!-- Main form card -->
    <div class="bg-surface border border-border rounded-xl p-5 space-y-3">
      <div v-if="errorMsg" class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p class="text-sm text-red-500 leading-snug">{{ errorMsg }}</p>
      </div>

      <form @submit.prevent="signInEmail" class="space-y-3">
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
          placeholder="Password"
          autocomplete="current-password"
          required
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 px-4 rounded-lg bg-brand-cta text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
        <p class="text-center text-xs text-muted pt-1">
          Don't have an account?
          <RouterLink to="/register" class="text-brand-cta hover:underline">Register →</RouterLink>
        </p>
      </form>
    </div>

    <!-- GitHub card -->
    <div class="mt-3 bg-surface border border-border rounded-xl p-5">
      <p class="text-xs text-muted text-center mb-3">Or continue with</p>
      <button
        @click="signInGitHub"
        class="w-full flex items-center justify-center gap-3 bg-brand-text text-surface py-2.5 px-4 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
        GitHub
      </button>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { login } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  if (route.query.error === 'github_not_configured') {
    errorMsg.value = 'GitHub OAuth is not configured on the server.'
  } else if (route.query.auth_error) {
    errorMsg.value = `Authentication failed: ${route.query.auth_error}`
  }
  if (errorMsg.value) router.replace({ query: {} })
  await auth.init()
  if (auth.isLoggedIn) router.push('/apps')
})

function signInGitHub() {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  window.location.href = `${base}/auth/github`
}

async function signInEmail() {
  loading.value = true
  errorMsg.value = ''
  try {
    await login(email.value, password.value)
    auth.initialized = false
    await auth.init()
    router.push('/apps')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    errorMsg.value = msg ?? 'Sign in failed. Please try again.'
  } finally {
    loading.value = false
  }
}


</script>
