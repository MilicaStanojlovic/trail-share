<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/AppButton.vue'
import AvatarInitials from '@/components/AvatarInitials.vue'
import BrandMark from '@/components/BrandMark.vue'
import type { Role } from '@/types/domain'

interface Props {
  role?: Role
  userName?: string
}

const props = withDefaults(defineProps<Props>(), {
  role: 'HIKER',
  userName: 'Ivana Kovač',
})

const emit = defineEmits<{
  (e: 'sign-out'): void
}>()

const route = useRoute()
const router = useRouter()

const isGuide = computed(() => props.role === 'GUIDE')
const mineLabel = computed(() => (isGuide.value ? 'My tours' : 'My bookings'))

// Section-level highlighting: bound manually rather than via RouterLink's
// automatic exact match, which cannot express "/routes but not /routes/new".
const routesCurrent = computed(() =>
  route.path.startsWith('/routes') && !route.path.startsWith('/routes/new') ? 'page' : undefined,
)
const toursCurrent = computed(() => (route.path.startsWith('/tours') ? 'page' : undefined))
const mineCurrent = computed(() => (route.path === '/my' ? 'page' : undefined))
const dashboardCurrent = computed(() => (route.path === '/dashboard' ? 'page' : undefined))

function goDraw() {
  router.push('/routes/new')
}
</script>

<template>
  <nav
    class="nav"
    style="
      padding: 14px 32px;
      gap: 26px;
      position: sticky;
      top: 0;
      z-index: 500;
      background: var(--color-bg);
    "
  >
    <div
      class="nav-brand"
      style="display: flex; align-items: center; gap: 9px; margin-right: 18px"
    >
      <BrandMark :size="24" />
      TrailShare
    </div>

    <RouterLink to="/routes" :aria-current="routesCurrent">Routes</RouterLink>
    <RouterLink to="/tours" :aria-current="toursCurrent">Tours</RouterLink>
    <RouterLink to="/my" :aria-current="mineCurrent">{{ mineLabel }}</RouterLink>
    <RouterLink v-if="isGuide" to="/dashboard" :aria-current="dashboardCurrent">
      Dashboard
    </RouterLink>

    <div style="margin-left: auto; display: flex; align-items: center; gap: 14px">
      <AppButton @click="goDraw">＋ Draw a route</AppButton>
      <div title="Sign out" style="cursor: pointer; display: flex" @click="emit('sign-out')">
        <AvatarInitials :name="userName" :size="34" bg="accent-2" />
      </div>
    </div>
  </nav>
</template>
