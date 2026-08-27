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
const profileCurrent = computed(() => (route.path === '/profile' ? 'page' : undefined))

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
      <!-- The design makes this avatar the sign-out button. It links to the
           profile instead: clicking your own face to log out is a surprising
           affordance, and sign-out now lives on that page. A RouterLink rather
           than the design's bare div so it is keyboard reachable; the styling
           is stripped back so it still renders as just the avatar. -->
      <RouterLink
        to="/profile"
        title="Your profile"
        aria-label="Your profile"
        class="avatar-link"
        :aria-current="profileCurrent"
      >
        <AvatarInitials :name="userName" :size="34" bg="accent-2" />
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.avatar-link {
  display: flex;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  border-radius: 999px;
}

/* `.nav a:hover` and `.nav a[aria-current]` recolour link text to accent,
   which would tint the initials orange inside their sage circle. The avatar
   keeps its own colour in every state; aria-current still carries the "you are
   here" signal to assistive tech. */
.avatar-link,
.avatar-link:hover,
.avatar-link[aria-current='page'] {
  color: inherit;
}
</style>
