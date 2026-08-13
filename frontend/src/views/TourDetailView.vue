<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToursStore } from '@/stores/tours'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import { difficultyTagVariant } from '@/types/ui'
import { formatDateLong } from '@/lib/dates'
import TrailMap from '@/components/TrailMap.vue'
import AppButton from '@/components/AppButton.vue'
import Tag from '@/components/Tag.vue'
import AvatarInitials from '@/components/AvatarInitials.vue'
import CapacityBar from '@/components/CapacityBar.vue'

const route = useRoute()
const router = useRouter()
const toursStore = useToursStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const tour = computed(() => toursStore.current)

// Route params are typed `string | string[]`; the catalog only ever produces a
// single `:id` segment, so collapse the array form to its first value.
function idOf(value: string | string[] | undefined): string {
  if (value === undefined) return ''
  return Array.isArray(value) ? (value[0] ?? '') : value
}

async function load(id: string): Promise<void> {
  try {
    await toursStore.fetchTour(id)
  } catch {
    toastStore.show('Tour not found')
    await router.replace('/tours')
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
  <section v-if="tour" class="tour-detail">
    <div class="tour-detail__map">
      <div class="tour-detail__map-layer">
        <TrailMap mode="view" :coords="tour.route.waypoints" />
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
        @click="router.push('/tours')"
      >
        ← All tours
      </AppButton>
    </div>

    <div class="tour-detail__panel">
      <div class="tour-detail__tags">
        <Tag :variant="difficultyTagVariant(tour.route.difficulty)">
          {{ tour.route.difficulty }}
        </Tag>
        <Tag>{{ tour.route.activity }}</Tag>
      </div>

      <h2 class="tour-detail__title">{{ tour.route.name }}</h2>

      <div class="tour-detail__date">
        {{ formatDateLong(tour.date) }} · {{ tour.timeLabel }}
      </div>

      <p class="tour-detail__notes">{{ tour.notes }}</p>

      <div class="tour-detail__details">
        <div class="tour-detail__row">
          <span>Meeting point</span>
          <span>{{ tour.meetingPoint }}</span>
        </div>
        <div class="tour-detail__row">
          <span>Distance</span>
          <span>{{ tour.route.distanceLabel }} · ↑ {{ tour.route.elevationLabel }}</span>
        </div>
        <div class="tour-detail__row">
          <span>Pace</span>
          <span>{{ tour.pace }}</span>
        </div>
        <div class="tour-detail__row">
          <span>Seats</span>
          <span>{{ tour.bookedCount }} / {{ tour.capacity }} booked</span>
        </div>
        <CapacityBar :booked="tour.bookedCount" :capacity="tour.capacity" />
      </div>

      <div class="tour-detail__guide">
        <AvatarInitials :name="tour.guide.displayName" :size="40" bg="accent-2" />
        <div>
          <div class="tour-detail__guide-name">{{ tour.guide.displayName }}</div>
          <div class="tour-detail__guide-stat">
            Guide · {{ tour.guide.toursLed }} tours led · {{ tour.guide.rating }} ★
          </div>
        </div>
      </div>

      <!-- Booking lands in slice 6: the CTA renders per the design for hikers
           only, but stays disabled regardless of remaining seats. -->
      <AppButton
        v-if="!authStore.isGuide"
        variant="primary"
        block
        disabled
        :style="{ minHeight: '46px', fontSize: '16px' }"
      >
        {{ tour.isFull ? 'Tour is full' : 'Book a seat' }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.tour-detail {
  display: grid;
  grid-template-columns: 1fr 400px;
  min-height: calc(100vh - 63px);
  animation: ts-rise 0.35s ease both;
}

.tour-detail__map {
  position: relative;
  margin: 0 0 0 32px;
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.tour-detail__map-layer {
  position: absolute;
  inset: 0;
}

.tour-detail__panel {
  padding: 8px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tour-detail__tags {
  display: flex;
  gap: 6px;
}

.tour-detail__title {
  font-size: 32px;
  margin: 0;
}

.tour-detail__date {
  font-family: var(--font-heading);
  font-size: 18px;
  color: var(--color-accent-700);
}

.tour-detail__notes {
  margin: 0;
  opacity: 0.8;
  font-size: 14px;
}

.tour-detail__details {
  background: var(--color-surface);
  border-radius: 22px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tour-detail__row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.tour-detail__row span:first-child {
  opacity: 0.6;
}

.tour-detail__guide {
  border: 1px solid var(--color-divider);
  border-radius: 22px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.tour-detail__guide-name {
  font-family: var(--font-heading);
  font-size: 15px;
}

.tour-detail__guide-stat {
  font-size: 12px;
  opacity: 0.65;
}
</style>
