<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBookingsStore } from '@/stores/bookings'
import { useToastStore } from '@/stores/toast'
import { formatDateLong } from '@/lib/dates'
import DataTable from '@/components/DataTable.vue'
import EmptyState from '@/components/EmptyState.vue'
import Tag from '@/components/Tag.vue'
import AppButton from '@/components/AppButton.vue'
import type { BookingStatus } from '@/types/domain'

const router = useRouter()
const authStore = useAuthStore()
const bookingsStore = useBookingsStore()
const toastStore = useToastStore()

// DataTable is generic over Record<string, unknown>, so the row type has to
// carry an index signature.
interface BookingRow extends Record<string, unknown> {
  id: string
  tourId: string
  tour: string
  date: string
  guide: string
  status: BookingStatus
}

const columns = [
  { key: 'tour', label: 'Tour' },
  { key: 'date', label: 'Date' },
  { key: 'guide', label: 'Guide' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: '', align: 'right' as const },
]

const rows = computed<BookingRow[]>(() =>
  bookingsStore.mine.map((b) => ({
    id: b.id,
    tourId: b.tour.id,
    tour: b.tour.route.name,
    date: formatDateLong(b.tour.date),
    guide: b.tour.guide.displayName,
    status: b.status,
  })),
)

// Not while the request is still in flight: an unguarded empty state would
// claim the hiker holds no seats for the length of a request, then contradict
// itself.
const showEmpty = computed(() => !bookingsStore.loading && rows.value.length === 0)

function statusLabel(status: BookingStatus): string {
  return status === 'PAID' ? 'Paid' : 'Confirmed'
}

onMounted(async () => {
  // Guides get the placeholder variant this slice, and GET /bookings/mine would
  // only ever answer [] for them, so it is not called at all.
  if (authStore.isGuide) return

  try {
    await bookingsStore.fetchMine()
  } catch {
    toastStore.show('Could not load your bookings')
  }
})
</script>

<template>
  <div style="padding: 26px 32px 56px; max-width: 1060px; animation: ts-rise 0.35s ease both">
    <!-- The guide variant is deliberately minimal: the real table of tours a
         guide scheduled belongs to the guide dashboard slice. -->
    <template v-if="authStore.isGuide">
      <h2 style="margin-bottom: 4px">My tours</h2>
      <p style="margin: 0 0 24px; opacity: 0.7; font-size: 14px">
        Tours you scheduled, and how they are filling up.
      </p>

      <div style="margin-top: 20px">
        <EmptyState message="Nothing here yet." cta-label="Browse tours" @cta="router.push('/tours')" />
      </div>
    </template>

    <template v-else>
      <h2 style="margin-bottom: 4px">My bookings</h2>
      <p style="margin: 0 0 24px; opacity: 0.7; font-size: 14px">
        Seats you hold on upcoming guided tours.
      </p>

      <!-- The header row renders even with zero bookings, as in the design. -->
      <DataTable :columns="columns" :rows="rows">
        <template #cell-tour="{ row }: { row: BookingRow }">
          <span style="font-weight: 600">{{ row.tour }}</span>
        </template>
        <template #cell-status="{ row }: { row: BookingRow }">
          <Tag variant="accent-2">{{ statusLabel(row.status) }}</Tag>
        </template>
        <template #cell-action="{ row }: { row: BookingRow }">
          <AppButton variant="ghost" @click="router.push('/tours/' + row.tourId)">
            View tour
          </AppButton>
        </template>
      </DataTable>

      <div v-if="showEmpty" style="margin-top: 20px">
        <EmptyState message="Nothing here yet." cta-label="Browse tours" @cta="router.push('/tours')" />
      </div>
    </template>
  </div>
</template>
