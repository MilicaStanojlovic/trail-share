<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoutesStore } from '@/stores/routes'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { difficultyTagVariant, seatTagState } from '@/types/ui'
import { formatDateLong } from '@/lib/dates'
import TrailMap from '@/components/TrailMap.vue'
import AppButton from '@/components/AppButton.vue'
import Tag from '@/components/Tag.vue'
import StatTile from '@/components/StatTile.vue'
import EmptyState from '@/components/EmptyState.vue'
import ScheduleTourDialog from '@/components/ScheduleTourDialog.vue'

const route = useRoute()
const router = useRouter()
const routesStore = useRoutesStore()
const toursStore = useToursStore()
const authStore = useAuthStore()
const toastStore = useToastStore()

const currentRoute = computed(() => routesStore.current)
const dialogOpen = ref(false)

const routeTours = computed(() => {
  // Keeps a previous route's tours from flashing while the new fetch is in flight.
  return toursStore.routeTours.filter((t) => t.route.id === idOf(route.params.id))
})

// Route params are typed `string | string[]`; the catalog only ever produces a
// single `:id` segment, so collapse the array form to its first value.
function idOf(value: string | string[] | undefined): string {
  if (value === undefined) return ''
  return Array.isArray(value) ? (value[0] ?? '') : value
}

async function load(id: string): Promise<void> {
  try {
    await routesStore.fetchRoute(id)
  } catch {
    toastStore.show('Route not found')
    await router.replace('/routes')
    return
  }

  // A tour-list failure must never bounce the user off a route that loaded fine.
  try {
    await toursStore.fetchRouteTours(id)
  } catch {
    // no-op
  }
}

async function onScheduled(): Promise<void> {
  // Re-fetch the route tours so the new tour appears in date order.
  // A tour-list failure must never bounce the user off a route that loaded fine.
  try {
    await toursStore.fetchRouteTours(idOf(route.params.id))
  } catch {
    // no-op: the dialog already showed a toast.
  }
}

onMounted(() => {
  void load(idOf(route.params.id))
})

watch(
  () => route.params.id,
  (id) => {
    void load(idOf(id))
  },
)
</script>

<template>
  <section v-if="currentRoute" class="route-detail">
    <div class="route-detail__map">
      <div class="route-detail__map-layer">
        <TrailMap mode="view" :coords="currentRoute.waypoints" />
      </div>

      <AppButton
        variant="secondary"
        :style="{
          position: 'absolute',
          left: '16px',
          top: '16px',
          zIndex: 450,
          background: 'var(--color-bg)',
        }"
        @click="router.push('/routes')"
      >
        ← All routes
      </AppButton>
    </div>

    <div class="route-detail__panel">
      <div class="route-detail__tags">
        <Tag :variant="difficultyTagVariant(currentRoute.difficulty)">
          {{ currentRoute.difficulty }}
        </Tag>
        <Tag>{{ currentRoute.activity }}</Tag>
      </div>

      <h2 class="route-detail__title">{{ currentRoute.name }}</h2>

      <p class="route-detail__description">{{ currentRoute.description }}</p>

      <div class="route-detail__stats">
        <StatTile label="Distance" :value="currentRoute.distanceLabel" size="md" />
        <StatTile label="Elevation gain" :value="currentRoute.elevationLabel" size="md" />
        <StatTile label="Est. duration" :value="currentRoute.durationLabel" size="md" />
        <StatTile label="Waypoints" :value="currentRoute.waypointCount" size="md" />
      </div>

      <div class="route-detail__section-head">
        <h4>Upcoming tours</h4>
        <AppButton
          v-if="authStore.isGuide"
          variant="primary"
          @click="dialogOpen = true"
        >
          Schedule a tour
        </AppButton>
      </div>

      <div v-if="routeTours.length" class="route-detail__tours">
        <div
          v-for="t in routeTours"
          :key="t.id"
          class="card route-detail__tour"
          role="button"
          tabindex="0"
          @click="router.push('/tours/' + t.id)"
          @keydown.enter.prevent="router.push('/tours/' + t.id)"
          @keydown.space.prevent="router.push('/tours/' + t.id)"
        >
          <div style="display: flex; align-items: center; gap: 10px">
            <div class="route-detail__tour-date">
              {{ formatDateLong(t.date) }}
            </div>
            <Tag
              :variant="seatTagState(t.bookedCount, t.capacity, t.isBookedByMe).variant"
              style="margin-left: auto"
            >
              {{ seatTagState(t.bookedCount, t.capacity, t.isBookedByMe).label }}
            </Tag>
          </div>
          <div class="route-detail__tour-meta">
            {{ t.timeLabel }} · {{ t.meetingPoint }} · led by {{ t.guide.displayName }}
          </div>
        </div>
      </div>

      <!-- Not while the tour fetch is still in flight: it runs after the route
           fetch resolves, so an unguarded empty state claims a route has no
           tours for the length of a request, then contradicts itself. -->
      <EmptyState
        v-else-if="!toursStore.loading"
        compact
        message="No tours scheduled on this route yet."
      />
    </div>

    <ScheduleTourDialog
      v-if="currentRoute"
      :open="dialogOpen"
      :route="currentRoute"
      @close="dialogOpen = false"
      @scheduled="onScheduled"
    />
  </section>
</template>

<style scoped>
.route-detail {
  display: grid;
  grid-template-columns: 1fr 400px;
  min-height: calc(100vh - 63px);
  animation: ts-rise 0.35s ease both;
}

.route-detail__map {
  position: relative;
  margin: 0 0 0 32px;
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.route-detail__map-layer {
  position: absolute;
  inset: 0;
}

.route-detail__panel {
  padding: 8px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.route-detail__tags {
  display: flex;
  gap: 6px;
}

.route-detail__title {
  font-size: 34px;
  margin: 0;
}

.route-detail__description {
  margin: 0;
  opacity: 0.8;
}

.route-detail__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.route-detail__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.route-detail__section-head h4 {
  margin: 0;
}

.route-detail__tours {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.route-detail__tour {
  padding: 14px 16px;
  gap: 6px;
  cursor: pointer;
}

.route-detail__tour:hover {
  box-shadow: var(--shadow-md);
}

.route-detail__tour-date {
  font-family: var(--font-heading);
  font-size: 15px;
}

.route-detail__tour-meta {
  font-size: 12px;
  opacity: 0.7;
}
</style>
