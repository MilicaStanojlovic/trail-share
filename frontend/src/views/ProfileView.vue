<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBookingsStore } from '@/stores/bookings'
import { useProfileStore } from '@/stores/profile'
import { useRoutesStore } from '@/stores/routes'
import { useToursStore } from '@/stores/tours'
import { useToastStore } from '@/stores/toast'
import { formatMemberSince } from '@/lib/dates'
import { signOut } from '@/lib/session'
import AppButton from '@/components/AppButton.vue'
import AvatarInitials from '@/components/AvatarInitials.vue'
import EmptyState from '@/components/EmptyState.vue'
import RouteCard from '@/components/RouteCard.vue'
import StatTile from '@/components/StatTile.vue'
import TourCard from '@/components/TourCard.vue'
import type { Tour } from '@/types/domain'

const router = useRouter()
const authStore = useAuthStore()
const bookingsStore = useBookingsStore()
const profileStore = useProfileStore()
const routesStore = useRoutesStore()
const toursStore = useToursStore()
const toastStore = useToastStore()

const isGuide = computed(() => authStore.isGuide)

// The guide line is byte-identical to the tour-detail guide card, so a guide's
// profile and their public byline never read differently.
const subline = computed(() => {
  const stats = profileStore.data?.stats
  if (stats === undefined) return ''
  if (stats.rating !== null) {
    return 'Guide · ' + stats.toursLed + ' tours led · ' + stats.rating.value + ' ★'
  }
  return 'Hiker · ' + stats.toursBooked + ' tours booked'
})

const roleLabel = computed(() => (isGuide.value ? 'Guide' : 'Hiker'))

// A hiker's tours are the ones they hold a seat on; a guide's are the ones they
// scheduled. Both render as TourCards.
const tours = computed<Tour[]>(() =>
  isGuide.value ? toursStore.mine : bookingsStore.mine.map((b) => b.tour),
)

// Not while the request is still in flight: an unguarded empty state would
// claim the user has nothing for the length of a request, then contradict
// itself. Same guard as MyBookingsView.
const showRoutesEmpty = computed(
  () => !routesStore.loading && routesStore.mine.length === 0,
)
const showToursEmpty = computed(() => {
  const loading = isGuide.value ? toursStore.loading : bookingsStore.loading
  return !loading && tours.value.length === 0
})

onMounted(async () => {
  try {
    await Promise.all([
      profileStore.fetchProfile(),
      routesStore.fetchMine(),
      // Never /tours/mine for a hiker: it is @Roles('GUIDE') and 403s.
      isGuide.value ? toursStore.fetchMine() : bookingsStore.fetchMine(),
    ])
  } catch {
    toastStore.show('Could not load your profile')
  }
})
</script>

<template>
  <div style="padding: 26px 32px 56px; max-width: 1060px; animation: ts-rise 0.35s ease both">
    <div class="profile__head">
      <AvatarInitials :name="authStore.user?.displayName ?? ''" :size="40" bg="accent-2" />
      <div>
        <h2 style="margin-bottom: 4px">{{ authStore.user?.displayName }}</h2>
        <!-- Held back until the payload lands so the line never reads
             "Guide · undefined tours led". -->
        <p v-if="profileStore.data" class="profile__subline">{{ subline }}</p>
      </div>
      <AppButton variant="secondary" style="margin-left: auto" @click="signOut(router)">
        Sign out
      </AppButton>
    </div>

    <template v-if="profileStore.data">
      <div class="profile__details">
        <div class="profile__row">
          <span>Email</span>
          <span>{{ profileStore.data.email }}</span>
        </div>
        <div class="profile__row">
          <span>Role</span>
          <span>{{ roleLabel }}</span>
        </div>
        <div class="profile__row">
          <span>Member since</span>
          <span>{{ formatMemberSince(profileStore.data.createdAt) }}</span>
        </div>
      </div>

      <div class="profile__stats" :class="{ 'profile__stats--guide': isGuide }">
        <StatTile
          size="lg"
          label="Routes published"
          :value="profileStore.data.stats.routesPublished"
        />

        <template v-if="profileStore.data.stats.rating">
          <StatTile
            size="lg"
            label="Tours led"
            :value="profileStore.data.stats.toursLed"
            note="across all time"
          />
          <StatTile
            size="lg"
            label="Seats hosted"
            :value="profileStore.data.stats.seatsHosted"
            note="across all tours"
          />
          <StatTile
            size="lg"
            label="Rating"
            :value="profileStore.data.stats.rating.value.toFixed(1)"
            :note="'from ' + profileStore.data.stats.rating.count + ' hikers'"
          />
        </template>

        <template v-else>
          <StatTile
            size="lg"
            label="Tours booked"
            :value="profileStore.data.stats.toursBooked"
            note="seats you have held"
          />
          <StatTile
            size="lg"
            label="Upcoming tours"
            :value="profileStore.data.stats.upcomingBookings"
            note="still to come"
          />
        </template>
      </div>
    </template>

    <h4 class="profile__section-head">Routes you published</h4>

    <div class="profile__route-grid">
      <RouteCard
        v-for="r in routesStore.mine"
        :key="r.id"
        :route="r"
        @open="router.push('/routes/' + r.id)"
      />
    </div>

    <EmptyState
      v-if="showRoutesEmpty"
      message="Nothing here yet."
      cta-label="Draw a route"
      @cta="router.push('/routes/new')"
    />

    <h4 class="profile__section-head">
      {{ isGuide ? 'Tours you scheduled' : 'Tours you booked' }}
    </h4>

    <div class="profile__tour-grid">
      <TourCard
        v-for="t in tours"
        :key="t.id"
        :tour="t"
        :cta="isGuide ? 'Manage' : undefined"
        @open="router.push('/tours/' + t.id)"
      />
    </div>

    <EmptyState
      v-if="showToursEmpty"
      message="Nothing here yet."
      :cta-label="isGuide ? 'Browse routes' : 'Browse tours'"
      @cta="router.push(isGuide ? '/routes' : '/tours')"
    />
  </div>
</template>

<style scoped>
.profile__head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}

.profile__subline {
  margin: 0;
  opacity: 0.7;
  font-size: 14px;
}

/* The details card from tour detail, at page width. */
.profile__details {
  background: var(--color-surface);
  border-radius: 22px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 22px;
}

.profile__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
}

.profile__row > span:first-child {
  opacity: 0.6;
}

.profile__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 32px;
}

.profile__stats--guide {
  grid-template-columns: repeat(4, 1fr);
}

.profile__section-head {
  margin-bottom: 12px;
}

.profile__route-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.profile__tour-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}

/* The grids collapse to nothing when empty; the EmptyState that follows
   supplies its own breathing room. */
.profile__route-grid:empty,
.profile__tour-grid:empty {
  display: none;
}

.profile__section-head:not(:first-of-type) {
  margin-top: 32px;
}
</style>
