<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { useRoutesStore } from '@/stores/routes'
import { useToursStore } from '@/stores/tours'
import { useToastStore } from '@/stores/toast'
import { difficultyTagVariant } from '@/types/ui'
import type { TagVariant } from '@/types/ui'
import { formatDateLong } from '@/lib/dates'
import DataTable from '@/components/DataTable.vue'
import StatTile from '@/components/StatTile.vue'
import Tag from '@/components/Tag.vue'
import RouteSparkline from '@/components/RouteSparkline.vue'
import AppButton from '@/components/AppButton.vue'
import type { TrailRoute } from '@/types/domain'

const router = useRouter()
const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const routesStore = useRoutesStore()
const toursStore = useToursStore()
const toastStore = useToastStore()

// The design greets with "Good morning" unconditionally — no time-of-day
// switching. `split(' ')[0]` is `string | undefined` under
// noUncheckedIndexedAccess, so fall back to the whole display name.
const firstName = computed(
  () => authStore.user?.displayName.split(' ')[0] ?? authStore.user?.displayName ?? '',
)

const nextTourNote = computed(() => {
  const days = dashboardStore.data?.nextTourInDays ?? null
  if (days === null) return 'no upcoming tours'
  if (days === 0) return 'next is today'
  if (days === 1) return 'next in 1 day'
  return 'next in ' + days + ' days'
})

// DataTable is generic over Record<string, unknown>, so the row type has to
// carry an index signature.
interface TourRow extends Record<string, unknown> {
  id: string
  route: string
  date: string
  seats: string
  seatVariant: TagVariant
}

const columns = [
  { key: 'route', label: 'Route' },
  { key: 'date', label: 'Date' },
  { key: 'seats', label: 'Booked' },
  { key: 'action', label: '', align: 'right' as const },
]

// A guide looking at their own tours never gets the "You are in" variant, so
// this is the seat tag without that branch, and always the "n / m booked" label.
function seatVariant(isFull: boolean, seatsLeft: number): TagVariant {
  if (isFull) return 'accent'
  if (seatsLeft <= 3) return 'outline'
  return 'neutral'
}

const tourRows = computed<TourRow[]>(() =>
  toursStore.mine.map((t) => ({
    id: t.id,
    route: t.route.name,
    date: formatDateLong(t.date),
    seats: t.bookedCount + ' / ' + t.capacity + ' booked',
    seatVariant: seatVariant(t.isFull, t.seatsLeft),
  })),
)

// Same wording as RouteCard.
function tourLabel(route: TrailRoute): string {
  if (route.tourCount === 0) return 'no tours yet'
  if (route.tourCount === 1) return '1 tour scheduled'
  return route.tourCount + ' tours scheduled'
}

onMounted(async () => {
  try {
    await Promise.all([
      dashboardStore.fetchDashboard(),
      toursStore.fetchMine(),
      routesStore.fetchMine(),
    ])
  } catch {
    toastStore.show('Could not load your dashboard')
  }
})
</script>

<template>
  <div style="padding: 26px 32px 56px; animation: ts-rise .35s ease both">
    <h2 style="margin-bottom: 4px">Good morning, {{ firstName }}</h2>

    <!-- Held back until the payload lands so no tile or count shows undefined. -->
    <template v-if="dashboardStore.data">
      <p style="margin: 0 0 22px; opacity: .7; font-size: 14px">
        You have {{ dashboardStore.data.toursScheduled }} tours on the calendar and
        {{ dashboardStore.data.routesPublished }} published routes.
      </p>

      <div
        style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 32px"
      >
        <StatTile
          size="lg"
          label="Tours scheduled"
          :value="dashboardStore.data.toursScheduled"
          :note="nextTourNote"
        />
        <StatTile
          size="lg"
          label="Seats booked"
          :value="dashboardStore.data.seatsBooked"
          note="across all tours"
        />
        <!-- "1 awaiting photos" is design flavor only: nothing in the API tracks
             photos, so the note is the design's literal string. -->
        <StatTile
          size="lg"
          label="Routes published"
          :value="dashboardStore.data.routesPublished"
          note="1 awaiting photos"
        />
        <StatTile
          size="lg"
          label="Rating"
          :value="dashboardStore.data.rating.value.toFixed(1)"
          :note="'from ' + dashboardStore.data.rating.count + ' hikers'"
        />
      </div>
    </template>

    <div style="display: grid; grid-template-columns: 1.35fr 1fr; gap: 34px">
      <div>
        <h4 style="margin-bottom: 10px">Your scheduled tours</h4>

        <!-- The header row renders even with zero tours, as in the design. -->
        <DataTable :columns="columns" :rows="tourRows">
          <template #cell-route="{ row }: { row: TourRow }">
            <span style="font-weight: 600">{{ row.route }}</span>
          </template>
          <template #cell-seats="{ row }: { row: TourRow }">
            <Tag :variant="row.seatVariant">{{ row.seats }}</Tag>
          </template>
          <template #cell-action="{ row }: { row: TourRow }">
            <AppButton variant="ghost" @click="router.push('/tours/' + row.id)">
              Manage
            </AppButton>
          </template>
        </DataTable>
      </div>

      <div>
        <h4 style="margin-bottom: 10px">Routes you published</h4>

        <div style="display: flex; flex-direction: column; gap: 10px">
          <!-- Keyboard reachable, unlike the design's bare div — same call made
               in RouteCard and on the route-detail tour cards. -->
          <div
            v-for="r in routesStore.mine"
            :key="r.id"
            class="card dashboard-route"
            role="button"
            tabindex="0"
            @click="router.push('/routes/' + r.id)"
            @keydown.enter.prevent="router.push('/routes/' + r.id)"
            @keydown.space.prevent="router.push('/routes/' + r.id)"
          >
            <div class="dashboard-route__spark">
              <RouteSparkline :coords="r.waypoints" :stroke-width="3" />
            </div>
            <div style="flex: 1">
              <div style="font-family: var(--font-heading); font-size: 15px">{{ r.name }}</div>
              <div style="font-size: 11px; opacity: .6">
                {{ r.distanceLabel }} · {{ tourLabel(r) }}
              </div>
            </div>
            <Tag :variant="difficultyTagVariant(r.difficulty)">{{ r.difficulty }}</Tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-route {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
}

.dashboard-route:hover {
  box-shadow: var(--shadow-md);
}

.dashboard-route__spark {
  flex: none;
  width: 58px;
  height: 34px;
  border-radius: 10px;
  background: var(--color-accent-2-200);
  overflow: hidden;
}
</style>
