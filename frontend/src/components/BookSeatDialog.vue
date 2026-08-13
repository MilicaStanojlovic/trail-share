<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBookingsStore } from '@/stores/bookings'
import { useToastStore } from '@/stores/toast'
import { formatDateLong } from '@/lib/dates'
import { ApiError } from '@/lib/api'
import AppDialog from '@/components/AppDialog.vue'
import AppButton from '@/components/AppButton.vue'
import type { Tour, Booking } from '@/types/domain'

const props = defineProps<{
  open: boolean
  tour: Tour
}>()

const emit = defineEmits<{
  close: []
  booked: [booking: Booking]
}>()

const bookingsStore = useBookingsStore()
const toastStore = useToastStore()

const submitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      submitting.value = false
    }
  },
)

// timeLabel is the range ("08:00 – 10:30"), matching the design's interpolation.
const body = computed(() => {
  return (
    props.tour.route.name +
    ' on ' +
    formatDateLong(props.tour.date) +
    ' at ' +
    props.tour.timeLabel +
    '. Meet at ' +
    props.tour.meetingPoint +
    '. You can cancel up to 24 h before.'
  )
})

async function submit() {
  if (submitting.value) return

  submitting.value = true
  try {
    const booking = await bookingsStore.bookSeat(props.tour.id)
    toastStore.show('Seat booked — see it under My bookings')
    emit('booked', booking)
    emit('close')
  } catch (error: unknown) {
    // The seat state changed under the user, so there is nothing in a form for
    // them to correct: surface the server's conflict message and close, leaving
    // the parent view to refetch the tour.
    toastStore.show(
      error instanceof ApiError && error.status === 409
        ? error.message
        : 'Could not book that seat',
    )
    emit('close')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" title="Book one seat?" @close="$emit('close')">
    <div class="dialog-body">{{ body }}</div>

    <template #actions>
      <AppButton variant="secondary" @click="$emit('close')">Not now</AppButton>
      <AppButton variant="primary" :disabled="submitting" @click="submit">
        Confirm booking
      </AppButton>
    </template>
  </AppDialog>
</template>
