<script setup lang="ts">
import { computed } from 'vue'
import Tag from '@/components/Tag.vue'
import AvatarInitials from '@/components/AvatarInitials.vue'
import DateBadge from '@/components/DateBadge.vue'
import CapacityBar from '@/components/CapacityBar.vue'
import AppButton from '@/components/AppButton.vue'
import { difficultyTagVariant, seatTagState } from '@/types/ui'
import type { Tour } from '@/types/domain'

// `cta` overrides the booking label. A guide looking at a tour they scheduled
// must not be offered a seat on it.
const props = defineProps<{ tour: Tour; cta?: string }>()
const emit = defineEmits<{ (e: 'open'): void }>()

const seat = computed(() => seatTagState(props.tour.bookedCount, props.tour.capacity, props.tour.isBookedByMe))

const ctaLabel = computed(
  () =>
    props.cta ??
    (props.tour.isBookedByMe
      ? 'Booked'
      : props.tour.seatsLeft > 0
        ? 'Book a seat'
        : 'Join waitlist')
)

function onCtaClick() {
  emit('open')
}
</script>

<template>
  <div
    class="card elev-sm tour-card"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <div class="tour-card-header">
      <DateBadge :date="tour.date" />
      <div class="tour-card-title-col">
        <div class="card-title tour-card-name">{{ tour.route.name }}</div>
        <div class="tour-card-meta-line">{{ tour.timeLabel }} · {{ tour.meetingPoint }}</div>
      </div>
    </div>

    <div class="tour-card-tags">
      <Tag :variant="difficultyTagVariant(tour.route.difficulty)">
        {{ tour.route.difficulty }}
      </Tag>
      <Tag>{{ tour.route.distanceLabel }}</Tag>
      <Tag :variant="seat.variant">{{ seat.label }}</Tag>
    </div>

    <CapacityBar :booked="tour.bookedCount" :capacity="tour.capacity" />

    <div class="tour-card-footer">
      <AvatarInitials :name="tour.guide.displayName" :size="24" />
      <span class="tour-card-guide">{{ tour.guide.displayName }}</span>
      <AppButton class="tour-card-cta" @click.stop="onCtaClick">
        {{ ctaLabel }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.tour-card {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
}

.tour-card:hover {
  box-shadow: var(--shadow-md);
}

.tour-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tour-card-title-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tour-card-name {
  font-size: 18px;
}

.tour-card-meta-line {
  font-size: 12px;
  opacity: 0.65;
}

.tour-card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tour-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tour-card-guide {
  font-size: 12px;
  opacity: 0.75;
}

.tour-card-cta {
  margin-left: auto;
}
</style>
