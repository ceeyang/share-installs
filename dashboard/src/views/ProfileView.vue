<!-- dashboard/src/views/ProfileView.vue -->
<template>
  <AppLayout>
    <div class="max-w-lg mx-auto py-8 px-4 space-y-4">
      <h1 class="text-lg font-bold text-brand-text">Profile</h1>

      <!-- Avatar & Display Name -->
      <div class="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h2 class="text-sm font-semibold text-brand-text">Avatar & Name</h2>
        <div class="flex items-center gap-4">
          <img
            :src="avatarUrl || fallbackAvatar"
            alt="avatar"
            class="w-14 h-14 rounded-full border border-border object-cover flex-shrink-0"
          />
          <button
            @click="regenerateAvatar"
            class="text-xs text-brand-cta hover:underline cursor-pointer"
          >
            Regenerate avatar
          </button>
        </div>
        <input
          v-model="displayName"
          type="text"
          placeholder="Display name"
          maxlength="50"
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <button
          @click="saveProfile"
          :disabled="savingProfile"
          class="px-4 py-2 rounded-lg bg-brand-cta text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {{ savingProfile ? 'Saving…' : 'Save' }}
        </button>
        <p v-if="profileMsg" class="text-xs" :class="profileError ? 'text-red-500' : 'text-green-500'">
          {{ profileMsg }}
        </p>
      </div>

      <!-- Change Password (email users only) -->
      <div v-if="auth.user?.hasPassword" class="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 class="text-sm font-semibold text-brand-text">Change Password</h2>
        <input
          v-model="currentPassword"
          type="password"
          placeholder="Current password"
          autocomplete="current-password"
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="New password (min 8 characters)"
          autocomplete="new-password"
          class="w-full px-3 py-2.5 rounded-lg border border-border bg-transparent text-sm text-brand-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-brand-cta"
        />
        <button
          @click="savePassword"
          :disabled="savingPassword"
          class="px-4 py-2 rounded-lg bg-brand-cta text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {{ savingPassword ? 'Saving…' : 'Update password' }}
        </button>
        <p v-if="passwordMsg" class="text-xs" :class="passwordError ? 'text-red-500' : 'text-green-500'">
          {{ passwordMsg }}
        </p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { updateMe } from '@/api/auth'

const auth = useAuthStore()

const displayName = ref(auth.user?.displayName ?? '')
const avatarUrl = ref(auth.user?.avatarUrl ?? '')
const fallbackAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=default`

const currentPassword = ref('')
const newPassword = ref('')

const savingProfile = ref(false)
const profileMsg = ref('')
const profileError = ref(false)

const savingPassword = ref(false)
const passwordMsg = ref('')
const passwordError = ref(false)

onMounted(() => {
  displayName.value = auth.user?.displayName ?? ''
  avatarUrl.value = auth.user?.avatarUrl ?? ''
})

function regenerateAvatar() {
  const seed = Math.random().toString(36).slice(2, 10)
  avatarUrl.value = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`
}

async function saveProfile() {
  savingProfile.value = true
  profileMsg.value = ''
  profileError.value = false
  try {
    const updated = await updateMe({ displayName: displayName.value, avatarUrl: avatarUrl.value })
    if (auth.user) {
      auth.user.displayName = updated.displayName
      auth.user.avatarUrl = updated.avatarUrl
    }
    profileMsg.value = 'Saved!'
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    profileMsg.value = msg ?? 'Failed to save.'
    profileError.value = true
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  savingPassword.value = true
  passwordMsg.value = ''
  passwordError.value = false
  try {
    await updateMe({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    passwordMsg.value = 'Password updated!'
    currentPassword.value = ''
    newPassword.value = ''
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    passwordMsg.value = msg ?? 'Failed to update password.'
    passwordError.value = true
  } finally {
    savingPassword.value = false
  }
}
</script>
