<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import AppNav from '@/components/AppNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

async function onSignOut() {
  auth.logout()
  toast.show('Signed out')
  await router.push('/auth')
}
</script>

<template>
  <div>
    <!-- The router guard means this layout only renders for authenticated users,
         so the fallbacks are purely defensive. -->
    <AppNav
      :role="auth.user?.role ?? 'HIKER'"
      :user-name="auth.user?.displayName ?? ''"
      @sign-out="onSignOut"
    />
    <RouterView />
  </div>
</template>
